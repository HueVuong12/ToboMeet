import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Room, RoomDocument } from "./schemas/room.schema";
import { CreateRoomDto } from "./dto/create-room.dto";
import { User, UserDocument } from "../users/schemas/user.schema";
import { RoomActivity, RoomActivityDocument } from "./schemas/room-activity.schema";
import { RoomMemberResponse, RoomResponse } from "@tobomeet/shared/types";
import { RoomMember } from "./schemas/room-member.schema";
import { MeetingsService } from "../meetings/meetings.service";
import { Meeting } from "../meetings/schemas/meeting.schema";
import { RoomsGateway } from "./rooms.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class RoomsService {
  constructor(
    private eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RoomActivity.name) private activityModel: Model<RoomActivityDocument>,
    private readonly roomsGateway: RoomsGateway,
    private readonly meetingsService: MeetingsService,
  ) {}

  /**
   * Tạo phòng mới — auto-gen code, thêm owner vào members, tạo channel "General"
   */
  async createRoom(userId: string, dto: CreateRoomDto): Promise<RoomResponse> {
    const code = this.generateRoomCode();
    const initialRole = dto.type === "classroom" ? "teacher" : "leader";

    const room = await this.roomModel.create({
      name: dto.name,
      type: dto.type,
      code,
      ownerId: userId,
      // Đẩy object user đầu tiên vào với quyền owner/teacher/leader
      members: [{ userId, role: initialRole, joinedAt: new Date() }],
      channels: [{ name: "General" }],
    });

    await this.activityModel.create({
      roomId: room._id.toString(),
      type: "CREATED",
      metadata: {
        userId,
        details: "Phòng được tạo bởi chủ phòng",
      },
    });

    return this.mapToRoomResponse(room);
  }

  /**
   * Lấy danh sách phòng mà user đã tham gia
   */
  async getMyRooms(userId: string): Promise<RoomResponse[]> {
    const rooms = await this.roomModel
      .find({
        members: {
          $elemMatch: {
            userId: userId,
            isLeft: { $ne: true },
            status: { $nin: ["REMOVED", "LEFT"] },
          },
        },
        isDeleted: { $ne: true },
        status: { $nin: ["disbanded", "blocked"] },
      })
      .sort({ updatedAt: -1 })
      .exec();

    // Map qua toàn bộ mảng
    return rooms.map((room) => this.mapToRoomResponse(room));
  }

  /**
   * Lấy danh sách user trong phòng
   */
  async getRoomMembers(roomId: string): Promise<RoomMemberResponse[]> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    const activeMembers = room.members.filter((member) => member.isLeft !== true && member.status !== "REMOVED" && member.status !== "LEFT");
    const memberUserIds = activeMembers.map((member) => member.userId);
    const users = await this.userModel
      .find({ supabaseId: { $in: memberUserIds } })
      .exec();

    // Định nghĩa thứ tự ưu tiên vai trò
    const rolePriorityMap: Record<string, number> = room.type === "classroom" 
      ? { teacher: 1, owner: 1, assistant: 2, admin: 2, student: 3, member: 3 }
      : { leader: 1, owner: 1, vice_leader: 2, admin: 2, member: 3, student: 3 };

    // Sắp xếp thành viên theo thứ tự ưu tiên
    activeMembers.sort((a, b) => {
      const pA = rolePriorityMap[a.role] || 99;
      const pB = rolePriorityMap[b.role] || 99;
      return pA - pB;
    });

    const data: RoomMemberResponse[] = activeMembers.map((member) => {
      const userInfo = users.find((u) => u.supabaseId === member.userId);

      return {
        userId: member.userId,
        role: member.role,
        status: member.status as "ACTIVE" | "REMOVED" | "LEFT" | undefined,
        joinedAt: member.joinedAt.toISOString(), // Ép ngày thành string
        removedAt: member.removedAt?.toISOString(),
        removedBy: member.removedBy,
        rejoinedAt: member.rejoinedAt?.toISOString(),
        displayName: userInfo?.displayName || "Người dùng ẩn danh",
        avatarUrl: userInfo?.avatarUrl || undefined,
        email: userInfo?.email || undefined,
      };
    });

    return data;
  }

  /**
   * Xóa thành viên khỏi phòng
   */
  async removeMember(roomId: string, targetUserId: string, ownerId: string) {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const operatorMember = room.members.find(
      (m) => m.userId === ownerId && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
    );
    if (!operatorMember) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }

    const isHighRole = ["owner", "teacher", "leader"].includes(operatorMember.role);
    const isSubRole = ["assistant", "vice_leader", "admin"].includes(operatorMember.role);

    if (!isHighRole && !isSubRole) {
      throw new ForbiddenException("Bạn không có quyền xóa thành viên khỏi phòng");
    }

    const targetMember = room.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new NotFoundException("Thành viên không tồn tại trong phòng");
    }

    if (["owner", "teacher", "leader"].includes(targetMember.role)) {
      throw new BadRequestException("Không thể xóa Giáo viên / Trưởng nhóm khỏi phòng");
    }

    if (isSubRole && ["assistant", "vice_leader", "admin"].includes(targetMember.role)) {
      throw new ForbiddenException("Ban cán sự / Phó nhóm không thể xóa thành viên cùng cấp");
    }

    // Đánh dấu là đã rời/bị xóa
    const memberIndex = room.members.findIndex((m) => m.userId === targetUserId);
    if (memberIndex !== -1) {
      room.members[memberIndex].isLeft = true;
      room.members[memberIndex].status = "REMOVED";
      room.members[memberIndex].removedBy = ownerId;
      room.members[memberIndex].removedAt = new Date();
      room.markModified("members");
      await room.save();
    }

    // Kiểm tra xem thành viên bị xóa có đang ở trong cuộc họp của phòng này hay không và kick nếu có
    try {
      const activeMeeting = (await this.roomModel.db.model("Meeting").findOne({
        roomId,
        status: "ongoing",
      }).exec()) as Meeting | null;

      if (activeMeeting) {
        // Kick khỏi LiveKit
        await this.meetingsService.removeParticipant(activeMeeting.meetingCode, targetUserId);
      }
    } catch (err) {
      console.log("[RoomsService] Không thể kick thành viên khỏi LiveKit (có thể không trong cuộc họp):", err);
    }

    // Ghi nhận hoạt động phòng
    const ownerUser = await this.userModel.findOne({ supabaseId: ownerId });
    const targetUser = await this.userModel.findOne({ supabaseId: targetUserId });
    const details = `${ownerUser?.displayName || "Chủ phòng"} đã xóa ${targetUser?.displayName || "Thành viên"} khỏi phòng.`;

    await this.activityModel.create({
      roomId,
      type: "MEMBER_REMOVED",
      metadata: {
        userId: ownerId,
        targetUserId,
        details,
      },
    });

    // Tạo thông báo cho người bị kick (async)
    this.eventEmitter.emit('notification.kicked', {
      userId: targetUserId,
      metadata: { 
        roomId: roomId,
        roomName: room.name,  // FE cần tên phòng để hiển thị: "Bạn bị kick khỏi phòng XYZ"
        kickedAt: new Date().toISOString()
      },
    });

    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "member_removed",
      removedUserId: targetUserId,
      roomId,
    });

    return { message: "Đã xóa thành viên" };
  }

  /**
   * Cập nhật vai trò thành viên (Phân quyền: Bổ nhiệm / Thu hồi)
   */
  async updateMemberRole(
    roomId: string,
    targetUserId: string,
    newRole: string,
    operatorId: string,
  ) {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const operatorMember = room.members.find(
      (m) => m.userId === operatorId && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
    );
    if (!operatorMember) {
      throw new ForbiddenException("Bạn không phải thành viên của phòng này");
    }

    // 1. Kiểm tra quyền thao tác của Operator
    if (room.type === "classroom") {
      if (operatorMember.role !== "teacher" && operatorMember.role !== "owner") {
        throw new ForbiddenException("Chỉ Giáo viên mới có quyền thay đổi vai trò thành viên");
      }
      if (!["assistant", "student"].includes(newRole)) {
        throw new BadRequestException("Vai trò không hợp lệ cho Phòng học");
      }
    } else {
      if (operatorMember.role !== "leader" && operatorMember.role !== "owner") {
        throw new ForbiddenException("Chỉ Trưởng nhóm mới có quyền thay đổi vai trò thành viên");
      }
      if (!["vice_leader", "member"].includes(newRole)) {
        throw new BadRequestException("Vai trò không hợp lệ cho Phòng họp");
      }
    }

    // 2. Tìm thành viên bị thay đổi
    const targetIdx = room.members.findIndex(
      (m) => m.userId === targetUserId && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
    );
    if (targetIdx === -1) {
      throw new NotFoundException("Thành viên không tồn tại trong phòng");
    }

    const targetMember = room.members[targetIdx];

    // Không được tự đổi vai trò của chính mình qua API này
    if (targetUserId === operatorId) {
      throw new BadRequestException("Bạn không thể tự thay đổi vai trò của chính mình");
    }

    // Không được đổi vai trò của Teacher / Leader qua API này (phải dùng chuyển quyền)
    if (["teacher", "leader", "owner"].includes(targetMember.role)) {
      throw new BadRequestException("Không thể thay đổi vai trò của Chủ phòng / Giáo viên / Trưởng nhóm bằng chức năng này");
    }

    const oldRole = targetMember.role;

    // 3. Kiểm tra giới hạn số lượng (Tối đa 3 Ban cán sự / 3 Phó nhóm)
    if (room.type === "classroom" && newRole === "assistant" && oldRole !== "assistant") {
      const assistantCount = room.members.filter(
        (m) => (m.role === "assistant" || m.role === "admin") && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
      ).length;
      if (assistantCount >= 3) {
        throw new BadRequestException("Đã đạt số lượng Ban cán sự tối đa (3).");
      }
    }

    if (room.type === "meeting" && newRole === "vice_leader" && oldRole !== "vice_leader") {
      const viceLeaderCount = room.members.filter(
        (m) => (m.role === "vice_leader" || m.role === "admin") && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
      ).length;
      if (viceLeaderCount >= 3) {
        throw new BadRequestException("Đã đạt số lượng Phó nhóm tối đa (3).");
      }
    }

    // Cập nhật vai trò
    room.members[targetIdx].role = newRole;
    room.markModified("members");
    await room.save();

    // 4. Ghi log hoạt động
    const operatorUser = await this.userModel.findOne({ supabaseId: operatorId });
    const targetUser = await this.userModel.findOne({ supabaseId: targetUserId });
    const opName = operatorUser?.displayName || "Người dùng";
    const tarName = targetUser?.displayName || "Thành viên";

    let message = "";
    if (room.type === "classroom") {
      if (newRole === "assistant") {
        message = `${opName} đã bổ nhiệm ${tarName} làm Ban cán sự.`;
      } else {
        message = `${opName} đã thu hồi quyền Ban cán sự của ${tarName}.`;
      }
    } else {
      if (newRole === "vice_leader") {
        message = `${opName} đã bổ nhiệm ${tarName} làm Phó nhóm.`;
      } else {
        message = `${opName} đã thu hồi quyền Phó nhóm của ${tarName}.`;
      }
    }

    await this.activityModel.create({
      roomId,
      type: "ROLE_UPDATED",
      metadata: {
        userId: operatorId,
        actorId: operatorId,
        actorName: opName,
        targetUserId,
        targetUserName: tarName,
        oldRole,
        newRole,
        details: message,
        roomType: room.type,
      },
    });

    // Notify WebSocket clients
    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "member_role_updated",
      roomId,
      targetUserId,
      newRole,
    });

    return { message, role: newRole };
  }

  /**
   * Chuyển quyền chủ phòng (Giáo viên -> Giáo viên mới, Trưởng nhóm -> Trưởng nhóm mới)
   */
  async transferOwner(roomId: string, newOwnerId: string, operatorId: string) {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const operatorMember = room.members.find(
      (m) => m.userId === operatorId && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
    );
    if (!operatorMember) {
      throw new ForbiddenException("Bạn không phải thành viên của phòng này");
    }

    // Kiểm tra operator phải là owner/teacher/leader
    if (room.type === "classroom") {
      if (operatorMember.role !== "teacher" && operatorMember.role !== "owner") {
        throw new ForbiddenException("Chỉ Giáo viên hiện tại mới được phép chuyển quyền Giáo viên");
      }
    } else {
      if (operatorMember.role !== "leader" && operatorMember.role !== "owner") {
        throw new ForbiddenException("Chỉ Trưởng nhóm hiện tại mới được phép chuyển quyền Trưởng nhóm");
      }
    }

    if (operatorId === newOwnerId) {
      throw new BadRequestException("Bạn đang là người nắm giữ quyền hạn cao nhất của phòng này");
    }

    const newOwnerIdx = room.members.findIndex(
      (m) => m.userId === newOwnerId && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
    );
    if (newOwnerIdx === -1) {
      throw new NotFoundException("Người được chọn không tồn tại trong phòng");
    }

    const operatorIdx = room.members.findIndex((m) => m.userId === operatorId);

    // Chuyển quyền: Owner/Teacher cũ hạ xuống Student/Member, Người mới thành Teacher/Leader
    const oldOwnerRole = operatorMember.role;
    const newOwnerTargetRole = room.type === "classroom" ? "teacher" : "leader";
    const oldOwnerTargetRole = room.type === "classroom" ? "student" : "member";

    room.ownerId = newOwnerId;
    room.members[newOwnerIdx].role = newOwnerTargetRole;
    if (operatorIdx !== -1) {
      room.members[operatorIdx].role = oldOwnerTargetRole;
    }

    room.markModified("members");
    await room.save();

    // Log Activity
    const operatorUser = await this.userModel.findOne({ supabaseId: operatorId });
    const newOwnerUser = await this.userModel.findOne({ supabaseId: newOwnerId });
    const opName = operatorUser?.displayName || "Người dùng";
    const newOwnerName = newOwnerUser?.displayName || "Thành viên";

    const titleRoleName = room.type === "classroom" ? "Giáo viên" : "Trưởng nhóm";
    const message = `${opName} đã chuyển quyền ${titleRoleName} cho ${newOwnerName}.`;

    await this.activityModel.create({
      roomId,
      type: "OWNER_TRANSFERRED",
      metadata: {
        userId: operatorId,
        actorId: operatorId,
        actorName: opName,
        targetUserId: newOwnerId,
        targetUserName: newOwnerName,
        oldRole: oldOwnerRole,
        newRole: newOwnerTargetRole,
        details: message,
        roomType: room.type,
      },
    });

    const updatedRoomPayload = this.mapToRoomResponse(room);

    // Notify via Sockets
    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "ownership_transferred",
      roomId,
      previousOwnerId: operatorId,
      newOwnerId,
      room: updatedRoomPayload,
    });

    return { message, newOwnerId, room: updatedRoomPayload };
  }

  /**
   * Tham gia phòng bằng mã code
   */
  async joinRoom(userId: string, roomCode: string): Promise<RoomResponse> {
    const room = await this.roomModel.findOne({ code: roomCode, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Không tìm thấy phòng với mã này");

    // Ràng buộc 1: Giới hạn 100 thành viên
    if (room.members.length >= 100) {
      throw new BadRequestException("Phòng đã đạt số lượng tối đa (100 người)");
    }

    // Ràng buộc 2: Kiểm tra trùng lặp
    const isAlreadyMember = room.members.some(
      (member) => member.userId === userId && member.isLeft !== true && member.status !== "REMOVED" && member.status !== "LEFT",
    );
    if (isAlreadyMember) {
      throw new BadRequestException("Bạn đã là thành viên của phòng này");
    }

    // Nếu từng bị xóa bởi chủ phòng (status === "REMOVED"), không cho tự tham gia lại
    // const removedMember = room.members.find((m) => m.userId === userId && m.status === "REMOVED");
    // if (removedMember) {
    //   throw new ForbiddenException("Bạn không còn là thành viên của phòng này");
    // }

    // Kiểm tra xem trước đó từng là thành viên và đã rời phòng (LEFT)
    const previousMemberIndex = room.members.findIndex(
      (member) => member.userId === userId && (member.isLeft === true || member.status === "LEFT"),
    );

    const now = new Date();
    let joinedAtDate = now;
    let rejoinedAtDate: Date | undefined = undefined;

    if (previousMemberIndex !== -1) {
      room.members[previousMemberIndex].isLeft = false;
      room.members[previousMemberIndex].status = "ACTIVE";
      room.members[previousMemberIndex].rejoinedAt = new Date();

      joinedAtDate = room.members[previousMemberIndex].joinedAt;
      rejoinedAtDate = now;
      
      room.markModified("members");
    } else {
      // Thêm member mới
      const defaultRole = room.type === "classroom" ? "student" : "member";
      room.members.push({ userId, role: defaultRole, joinedAt: new Date(), status: "ACTIVE", isLeft: false });
    }
    await room.save();

    // Lấy thông tin user từ Database
    const userInfo = await this.userModel.findOne({ supabaseId: userId });

    const existingMember = room.members.find((m) => m.userId === userId);
    const memberRole = existingMember?.role || (room.type === "classroom" ? "student" : "member");

    // Format dữ liệu chuẩn theo interface RoomMemberResponse
    const newMemberPayload: RoomMemberResponse = {
      userId: userId,
      role: memberRole,
      // status: "ACTIVE",
      joinedAt: joinedAtDate.toISOString(),
      ...(rejoinedAtDate && { rejoinedAt: rejoinedAtDate.toISOString() }),
      displayName: userInfo?.displayName || "Người dùng ẩn danh",
      avatarUrl: userInfo?.avatarUrl || undefined,
      email: userInfo?.email || undefined,
    };

    // Phát sự kiện qua Socket cho các client đang ở trong phòng
    this.roomsGateway.notifyRoomUpdated(room._id.toString(), {
      type: "member_joined", // Frontend sẽ bắt case này
      roomId: room._id.toString(),
      member: newMemberPayload, // Chứa object hoàn chỉnh để đưa thẳng vào RTK Query Cache
    });

    return this.mapToRoomResponse(room);
  }

  /**
   * Lấy chi tiết 1 phòng theo ID
   */
  async getRoomById(roomId: string): Promise<Room> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });

    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    return room;
  }

  async getRoomByIdForUser(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    if (room.status === "blocked") {
      throw new ForbiddenException("Phòng họp này đang bị tạm khóa do vi phạm quy định cộng đồng.");
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member || member.isLeft === true || member.status === "REMOVED" || member.status === "LEFT") {
      throw new ForbiddenException("Bạn không còn là thành viên của phòng này");
    }

    return room;
  }

  /**
   * Thêm kênh mới vào phòng (chỉ dành cho chủ phòng)
   */
  async addChannel(
    userId: string,
    roomId: string,
    channelName: string,
  ): Promise<Room> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });

    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    // Kiểm tra tên kênh đã trùng chưa (không phân biệt hoa thường)
    const exists = room.channels.some(
      (c) => c.name.toLowerCase() === channelName.trim().toLowerCase(),
    );
    if (exists) {
      throw new BadRequestException("Tên kênh đã tồn tại");
    }

    room.channels.push({
      name: channelName.trim(),
      createdAt: new Date(),
    });
    await room.save();

    return room;
  }

  /**
   * Thêm thành viên bằng email hoặc userId
   */
  async addMemberByEmailOrId(
    userId: string,
    roomId: string,
    payload: { email?: string; targetUserId?: string },
  ): Promise<RoomResponse> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    // Kiểm tra xem người thực hiện có quyền hay không (phải là thành viên trong phòng)
    const isRequesterMember = room.members.some((m) => m.userId === userId);
    if (!isRequesterMember) {
      throw new ForbiddenException(
        "Bạn không có quyền thêm thành viên vào phòng này",
      );
    }

    let targetUser: UserDocument | null = null;
    if (payload.targetUserId) {
      targetUser = await this.userModel.findOne({
        supabaseId: payload.targetUserId,
      });
    } else if (payload.email) {
      targetUser = await this.userModel.findOne({
        email: payload.email.trim().toLowerCase(),
      });
    }

    if (!targetUser) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    // Kiểm tra xem đã là thành viên chưa
    const isAlreadyMember = room.members.some(
      (m) => m.userId === targetUser!.supabaseId && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
    );
    if (isAlreadyMember) {
      throw new BadRequestException("Thành viên đã tham gia nhóm");
    }

    // Nếu trước đó đã rời phòng hoặc bị xóa, reset isLeft và update rejoinedAt
    const previousMemberIdx = room.members.findIndex(
      (m) => m.userId === targetUser!.supabaseId && (m.isLeft === true || m.status === "REMOVED" || m.status === "LEFT"),
    );

    if (previousMemberIdx !== -1) {
      room.members[previousMemberIdx].isLeft = false;
      room.members[previousMemberIdx].status = "ACTIVE";
      room.members[previousMemberIdx].rejoinedAt = new Date();
      room.markModified("members");
    } else {
      // Giới hạn 100 thành viên
      if (room.members.length >= 100) {
        throw new BadRequestException("Phòng đã đạt số lượng tối đa (100 người)");
      }
      // Thêm thành viên
      const defaultRole = room.type === "classroom" ? "student" : "member";
      room.members.push({
        userId: targetUser.supabaseId,
        role: defaultRole,
        joinedAt: new Date(),
        status: "ACTIVE",
        isLeft: false,
      });
    }
    await room.save();

    // Phát tín hiệu realtime
    this.roomsGateway.notifyRoomUpdated(room._id.toString(), {
      type: "member_added",
      addedUserId: targetUser.supabaseId,
      roomId: room._id.toString(),
    });

    return this.mapToRoomResponse(room);
  }

  /**
   * Thành viên tự rời phòng hoặc Trưởng nhóm rời phòng bàn giao quyền sở hữu
   */
  async leaveRoom(roomId: string, userId: string, newOwnerId?: string) {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      throw new BadRequestException("Bạn không phải thành viên phòng này");
    }

    if (member.role === "owner") {
      // Trường hợp 1: Phòng chỉ có duy nhất chủ phòng -> Giải tán phòng (xóa mềm)
      if (room.members.length === 1) {
        room.isDeleted = true;
        await room.save();
        return { message: "Đã giải tán phòng họp thành công" };
      }

      // Trường hợp 2: Có thành viên khác nhưng chưa chỉ định người kế nhiệm
      if (!newOwnerId) {
        throw new BadRequestException(
          "Chủ phòng phải bàn giao quyền trước khi rời phòng.",
        );
      }

      // Kiểm tra người nhận quyền có tồn tại trong phòng không
      const newOwnerIndex = room.members.findIndex((m) => m.userId === newOwnerId);
      if (newOwnerIndex === -1) {
        throw new BadRequestException(
          "Người kế nhiệm được chọn không thuộc phòng này.",
        );
      }

      // Thực hiện chuyển giao quyền sở hữu
      room.ownerId = newOwnerId;
      room.members[newOwnerIndex].role = "owner";
    }

    // Đánh dấu thành viên rời đi (kể cả chủ phòng cũ) là đã rời
    const memberIdx = room.members.findIndex((m) => m.userId === userId);
    if (memberIdx !== -1) {
      room.members[memberIdx].isLeft = true;
      room.members[memberIdx].status = "LEFT";
      room.markModified("members");
      await room.save();
    }

    // Phát tín hiệu realtime
    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "member_left",
      leftUserId: userId,
      newOwnerId: newOwnerId || null,
      roomId,
    });

    return { message: "Đã rời phòng thành công" };
  }

  /**
   * Giải tán phòng họp (xóa mềm - soft delete)
   */
  async disbandRoom(roomId: string, userId: string) {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    if (room.ownerId !== userId) {
      throw new ForbiddenException("Chỉ chủ phòng mới có quyền giải tán phòng");
    }

    room.status = "disbanded";
    room.isDeleted = true;
    await room.save();

    // Tạo thông báo cho tất cả thành viên trong phòng (async)
    this.eventEmitter.emit('notification.room_disbanded', {
      userIds: room.members
        .filter(m => m.status !== "REMOVED" && m.status !== "LEFT") // không thông báo cho người bị xoá hoặc đã rời
        .map(m => m.userId) // chỉ lấy id
        .filter(id => id !== userId), // loại trừ người thực hiện
      metadata: {
        roomId: roomId,
        roomName: room.name,
      },
    });

    return { message: "Đã giải tán phòng họp thành công" };
  }

  /**
   * Lấy thông tin sơ bộ của phòng bằng mã code
   */
  async getRoomByCode(code: string) {
    const room = await this.roomModel.findOne({ code: code.trim(), isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Không tìm thấy phòng họp này");
    return {
      _id: room._id.toString(),
      name: room.name,
      type: room.type,
      code: room.code,
    };
  }

  /**
   * Tạo mã phòng ngẫu nhiên 7 ký tự (chữ + số)
   */
  private generateRoomCode(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Hưng thêm vào, không đụng phần code bên dưới

  /**
   * Kiểm tra người dùng đã là thành viên của phòng hay chưa (bằng ID phòng)
   * Trả về: true nếu đang là thành viên hoạt động, false nếu chưa hoặc đã rời/bị xóa
   */
  async checkUserInRoomById(roomId: string, userId: string): Promise<boolean> {
    const isExist = await this.roomModel.exists({
      _id: roomId,
      isDeleted: { $ne: true }, // Bỏ qua các phòng đã bị giải tán
      members: {
        $elemMatch: {
          userId: userId,
          isLeft: { $ne: true }, // Phải chưa tự rời đi
          status: { $nin: ["REMOVED", "LEFT"] }, // Trạng thái không phải là đã bị xóa hoặc đã rời
        },
      },
    });

    return !!isExist;
  }

  /**
   * Kiểm tra người dùng đã là thành viên của phòng hay chưa (bằng Mã phòng - Code)
   */
  async checkUserInRoomByCode(roomCode: string, userId: string): Promise<boolean> {
    const isExist = await this.roomModel.exists({
      code: roomCode.trim(),
      isDeleted: { $ne: true },
      members: {
        $elemMatch: {
          userId: userId,
          isLeft: { $ne: true },
          status: { $nin: ["REMOVED", "LEFT"] },
        },
      },
    });

    return !!isExist;
  }

  /**
   * Bộ chuyển đổi: Mongoose Document -> RoomResponse chuẩn
   * Đảm bảo đồng bộ kiểu dữ liệu với frontend, tránh lộ thông tin nhạy cảm
   */
  private mapToRoomResponse(room: RoomDocument): RoomResponse {
    // Chuyển Mongoose Document thành plain JavaScript Object
    const plainRoom = room.toObject();

    return {
      _id: plainRoom._id.toString(),
      name: plainRoom.name,
      type: plainRoom.type as "meeting" | "classroom",
      code: plainRoom.code,
      ownerId: plainRoom.ownerId,
      // Ánh xạ channels (nếu có id sinh tự động thì chuyển sang string)
      channels: plainRoom.channels,
      // Ánh xạ members cơ bản (chỉ lấy những thành viên đang hoạt động)
      members: plainRoom.members
        ?.filter((m: RoomMember) => m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT")
        .map((m: RoomMember) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
      createdAt: plainRoom.createdAt.toISOString(),
      updatedAt: plainRoom.updatedAt.toISOString(),
    };
  }
}
