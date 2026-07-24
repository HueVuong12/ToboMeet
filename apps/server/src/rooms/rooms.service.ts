import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
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
import { getDisplayRole, normalizeRole } from "./helpers/room-role.helper";

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RoomActivity.name) private activityModel: Model<RoomActivityDocument>,
    private readonly roomsGateway: RoomsGateway,
    private readonly meetingsService: MeetingsService,
  ) {}

  /**
   * Tự động chạy Migration cập nhật toàn bộ Role cũ trong MongoDB về 3 role chuẩn: owner, vice, member
   */
  async onModuleInit() {
    try {
      const roomsWithLegacyRoles = await this.roomModel.find({
        "members.role": { $in: ["teacher", "assistant", "student", "leader", "vice_leader", "admin"] },
      });

      if (roomsWithLegacyRoles.length === 0) {
        this.logger.log("MongoDB RoomMember roles đã ở trạng thái chuẩn hóa (owner, vice, member). Không cần migration.");
        return;
      }

      let updatedMembersCount = 0;
      for (const room of roomsWithLegacyRoles) {
        let isModified = false;
        for (const member of room.members) {
          const newRole = normalizeRole(member.role);
          if (member.role !== newRole) {
            member.role = newRole;
            isModified = true;
            updatedMembersCount++;
          }
        }
        if (isModified) {
          room.markModified("members");
          await room.save();
        }
      }

      this.logger.log(
        `Migration thành công! Đã cập nhật ${updatedMembersCount} bản ghi thành viên trong ${roomsWithLegacyRoles.length} phòng họp/lớp học về 3 role chuẩn: owner, vice, member.`
      );
    } catch (err) {
      this.logger.error("Lỗi khi chạy Migration RoomMember roles:", err);
    }
  }

  /**
   * Tạo phòng mới — auto-gen code, thêm owner vào members, tạo channel "General"
   */
  async createRoom(userId: string, dto: CreateRoomDto): Promise<RoomResponse> {
    const code = this.generateRoomCode();

    const room = await this.roomModel.create({
      name: dto.name,
      type: dto.type,
      code,
      ownerId: userId,
      // Đẩy object user đầu tiên vào với quyền owner
      members: [{ userId, role: "owner", joinedAt: new Date() }],
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
    const validObjectIds = memberUserIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const users = await this.userModel
      .find({
        $or: [
          { supabaseId: { $in: memberUserIds } },
          { _id: { $in: validObjectIds } },
        ],
      })
      .exec();

    // Định nghĩa thứ tự ưu tiên vai trò: owner (1) -> vice (2) -> member (3)
    const rolePriorityMap: Record<string, number> = {
      owner: 1,
      teacher: 1,
      leader: 1,
      vice: 2,
      vice_leader: 2,
      assistant: 2,
      admin: 2,
      member: 3,
      student: 3,
    };

    // Sắp xếp thành viên theo thứ tự ưu tiên
    activeMembers.sort((a, b) => {
      const pA = rolePriorityMap[a.role] || 99;
      const pB = rolePriorityMap[b.role] || 99;
      return pA - pB;
    });

    const data: RoomMemberResponse[] = activeMembers.map((member) => {
      const userInfo = users.find(
        (u) => u.supabaseId === member.userId || u._id.toString() === member.userId,
      );
      const normalized = normalizeRole(member.role);

      return {
        userId: member.userId,
        role: normalized,
        displayRole: getDisplayRole(normalized, room.type),
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

    const opRole = normalizeRole(operatorMember.role);
    const isHighRole = opRole === "owner";
    const isSubRole = opRole === "vice";

    if (!isHighRole && !isSubRole) {
      throw new ForbiddenException("Bạn không có quyền xóa thành viên khỏi phòng");
    }

    const targetMember = room.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new NotFoundException("Thành viên không tồn tại trong phòng");
    }

    const targetRole = normalizeRole(targetMember.role);
    if (targetRole === "owner") {
      throw new BadRequestException(
        room.type === "classroom"
          ? "Không thể xóa Giảng viên khỏi phòng"
          : "Không thể xóa Trưởng nhóm khỏi phòng"
      );
    }

    if (isSubRole && targetRole === "vice") {
      const subTitle = room.type === "classroom" ? "Ban cán sự" : "Phó nhóm";
      throw new ForbiddenException(`${subTitle} không thể xóa thành viên cùng cấp`);
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
      roomName: room.name,
    });

    return { message: "Đã xóa thành viên" };
  }

  /**
   * Cập nhật vai trò thành viên (Phân quyền: Bổ nhiệm / Thu hồi)
   */
  async updateMemberRole(
    roomId: string,
    targetUserId: string,
    rawNewRole: string,
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

    const opRole = normalizeRole(operatorMember.role);
    if (opRole !== "owner") {
      const ownerTitle = room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
      throw new ForbiddenException(`Chỉ ${ownerTitle} mới có quyền thay đổi vai trò thành viên`);
    }

    const newRole = normalizeRole(rawNewRole);
    if (!["vice", "member"].includes(newRole)) {
      throw new BadRequestException("Vai trò không hợp lệ");
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

    const oldRole = normalizeRole(targetMember.role);
    if (oldRole === "owner") {
      const ownerTitle = room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
      throw new BadRequestException(`Không thể thay đổi vai trò của ${ownerTitle} bằng chức năng này`);
    }

    // 3. Kiểm tra giới hạn số lượng (Tối đa 3 Phó nhóm / Ban cán sự)
    if (newRole === "vice" && oldRole !== "vice") {
      const viceCount = room.members.filter(
        (m) => normalizeRole(m.role) === "vice" && m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
      ).length;
      if (viceCount >= 3) {
        const subTitle = room.type === "classroom" ? "Ban cán sự" : "Phó nhóm";
        throw new BadRequestException(`Đã đạt số lượng tối đa 3 ${subTitle}`);
      }
    }

    // Cập nhật vai trò trong DB
    room.members[targetIdx].role = newRole;
    room.markModified("members");
    await room.save();

    // 4. Ghi log hoạt động
    const operatorUser = await this.userModel.findOne({ supabaseId: operatorId });
    const targetUser = await this.userModel.findOne({ supabaseId: targetUserId });
    const opName = operatorUser?.displayName || "Người dùng";
    const tarName = targetUser?.displayName || "Thành viên";
    const subTitle = room.type === "classroom" ? "Ban cán sự" : "Phó nhóm";

    let message = "";
    if (newRole === "vice") {
      message = `${opName} đã bổ nhiệm ${tarName} làm ${subTitle}.`;
    } else {
      message = `${opName} đã thu hồi quyền ${subTitle} của ${tarName}.`;
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
      displayRole: getDisplayRole(newRole, room.type),
    });

    return { message, role: newRole, displayRole: getDisplayRole(newRole, room.type) };
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

    const opRole = normalizeRole(operatorMember.role);
    if (opRole !== "owner") {
      const ownerTitle = room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
      throw new ForbiddenException(`Chỉ ${ownerTitle} hiện tại mới được phép chuyển quyền ${ownerTitle}`);
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

    // Chuyển quyền: Owner cũ hạ xuống Member, Người mới thành Owner
    const oldOwnerRole = normalizeRole(operatorMember.role);

    room.ownerId = newOwnerId;
    room.members[newOwnerIdx].role = "owner";
    if (operatorIdx !== -1) {
      room.members[operatorIdx].role = "member";
    }

    // Reset vai trò của Owner mới trong tất cả các kênh thành member (không chiếm suất vice)
    if (room.channels && Array.isArray(room.channels)) {
      room.channels.forEach((c) => {
        if (c.members && Array.isArray(c.members)) {
          c.members.forEach((cm) => {
            if (cm.userId === newOwnerId) {
              cm.role = "member";
            }
          });
        }
      });
      room.markModified("channels");
    }

    room.markModified("members");
    await room.save();

    // Log Activity
    const operatorUser = await this.userModel.findOne({ supabaseId: operatorId });
    const newOwnerUser = await this.userModel.findOne({ supabaseId: newOwnerId });
    const opName = operatorUser?.displayName || "Người dùng";
    const newOwnerName = newOwnerUser?.displayName || "Thành viên";

    const titleRoleName = room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
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
        newRole: "owner",
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
      // Thêm member mới với vai trò chuẩn 'member' dưới DB
      room.members.push({ userId, role: "member", joinedAt: new Date(), status: "ACTIVE", isLeft: false });
    }
    this.sanitizeMemberRoles(room);
    await room.save();

    // Lấy thông tin user từ Database
    const userInfo = await this.userModel.findOne({ supabaseId: userId });

    const existingMember = room.members.find((m) => m.userId === userId);
    const memberRole = existingMember?.role || "member";

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

    let isObjectId = false;
    try {
      isObjectId = Types.ObjectId.isValid(userId);
    } catch (e) {}

    const userDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: userId },
          ...(isObjectId ? [{ _id: new Types.ObjectId(userId) }] : []),
        ],
      })
      .exec();

    const allowedUserIds = new Set<string>([userId]);
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    const member = room.members.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    if (!member) {
      throw new ForbiddenException("Bạn không còn là thành viên của phòng này");
    }

    // Nếu không phải là Chủ phòng (Owner), chỉ trả về các Kênh Công khai (isPrivate !== true)
    // hoặc Kênh Riêng tư mà người dùng được cấp quyền tham gia trong channel.members (và chưa bị xóa/rời đi)
    if (!allowedUserIds.has(room.ownerId) && room.channels) {
      room.channels = room.channels.filter(
        (c) =>
          !c.isPrivate ||
          c.members?.some(
            (m) =>
              allowedUserIds.has(m.userId) &&
              m.isLeft !== true &&
              m.status !== "REMOVED" &&
              m.status !== "LEFT",
          ),
      );
    }

    return room;
  }

  /**
   * Kiểm tra người dùng có quyền truy cập kênh chỉ định hay không (Public hoac Private va chua bi xoa)
   */
  async checkChannelAccess(roomId: string, channelId: string, userId: string): Promise<boolean> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) return false;

    let isObjectId = false;
    try {
      isObjectId = Types.ObjectId.isValid(userId);
    } catch (e) {}

    const userDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: userId },
          ...(isObjectId ? [{ _id: new Types.ObjectId(userId) }] : []),
        ],
      })
      .exec();

    const allowedUserIds = new Set<string>([userId]);
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    if (allowedUserIds.has(room.ownerId)) return true;

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) return false;

    if (!channel.isPrivate) return true;

    const member = channel.members?.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );

    return !!member;
  }

  /**
   * Thêm kênh mới vào phòng (chỉ dành cho chủ phòng)
   */
  async addChannel(
    userId: string,
    roomId: string,
    channelName: string,
    isPrivate: boolean = false,
    initialMemberIds: string[] = [],
  ): Promise<Room> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });

    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    if (room.ownerId !== userId) {
      throw new ForbiddenException("Chỉ chủ phòng mới có quyền tạo kênh mới");
    }

    // Kiểm tra tên kênh đã trùng chưa (không phân biệt hoa thường)
    const exists = room.channels.some(
      (c) => c.name.toLowerCase() === channelName.trim().toLowerCase(),
    );
    if (exists) {
      throw new BadRequestException("Tên kênh đã tồn tại");
    }

    const initialMembers = isPrivate
      ? Array.from(new Set(initialMemberIds)).map((id) => ({
          userId: id,
          role: "member",
        }))
      : [];

    room.channels.push({
      name: channelName.trim(),
      isPrivate: !!isPrivate,
      members: initialMembers,
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
    const isObjectId = Types.ObjectId.isValid(roomId);
    const room = await this.roomModel.findOne({
      $or: [
        ...(isObjectId ? [{ _id: roomId }] : []),
        { code: roomId },
      ],
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    // Kiểm tra xem người thực hiện có quyền hay không (phải là thành viên hoặc chủ phòng)
    const isRequesterMember =
      room.ownerId === userId || room.members.some((m) => m.userId === userId);
    if (!isRequesterMember) {
      throw new ForbiddenException(
        "Bạn không có quyền thêm thành viên vào phòng này",
      );
    }

    let targetUser: UserDocument | null = null;
    if (payload.targetUserId) {
      const isObjectId = Types.ObjectId.isValid(payload.targetUserId);
      targetUser = await this.userModel.findOne({
        $or: [
          { supabaseId: payload.targetUserId },
          ...(isObjectId ? [{ _id: payload.targetUserId }] : []),
        ],
      });
    } else if (payload.email) {
      targetUser = await this.userModel.findOne({
        email: payload.email.trim().toLowerCase(),
      });
    }

    if (!targetUser) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    const targetId = targetUser.supabaseId || targetUser._id?.toString();
    if (!targetId) {
      throw new BadRequestException("Không thể xác định ID của người dùng");
    }

    // Kiểm tra xem đã là thành viên (hoặc Chủ phòng) hay chưa
    const isAlreadyMember =
      room.ownerId === targetId ||
      room.members.some(
        (m) =>
          m.userId === targetId &&
          m.isLeft !== true &&
          m.status !== "REMOVED" &&
          m.status !== "LEFT",
      );
    if (isAlreadyMember) {
      throw new BadRequestException("Thành viên này đã ở trong phòng họp");
    }

    // Nếu trước đó đã rời phòng hoặc bị xóa, reset isLeft và update rejoinedAt
    const previousMemberIdx = room.members.findIndex(
      (m) =>
        m.userId === targetId &&
        (m.isLeft === true || m.status === "REMOVED" || m.status === "LEFT"),
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
      // Thêm thành viên với vai trò chuẩn 'member' dưới DB
      room.members.push({
        userId: targetId,
        role: "member",
        joinedAt: new Date(),
        status: "ACTIVE",
        isLeft: false,
      });
    }

    this.sanitizeMemberRoles(room);

    try {
      await room.save();
    } catch (err: any) {
      this.logger.error("Lỗi khi lưu thông tin thành viên vào phòng:", err);
      throw new BadRequestException(err?.message || "Không thể thêm thành viên vào phòng");
    }

    // Phát tín hiệu realtime an toàn
    try {
      this.roomsGateway?.notifyRoomUpdated(room._id.toString(), {
        type: "member_added",
        addedUserId: targetId,
        roomId: room._id.toString(),
      });
    } catch (e) {
      this.logger.warn("Không thể phát tín hiệu socket notifyRoomUpdated:", e);
    }

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
   * Kiểm tra xem người dùng có quyền quản lý thành viên / phân quyền trong Kênh hay không
   */
  /**
   * Kiểm tra xem người dùng có quyền quản lý thành viên / phân quyền trong Kênh hay không
   */
  async canManageChannelMembers(room: RoomDocument, channelId: string, userId: string): Promise<boolean> {
    let isObjectId = false;
    try {
      isObjectId = Types.ObjectId.isValid(userId);
    } catch (e) {}

    const userDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: userId },
          ...(isObjectId ? [{ _id: new Types.ObjectId(userId) }] : []),
        ],
      })
      .exec();

    const allowedUserIds = new Set<string>([userId]);
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    if (allowedUserIds.has(room.ownerId)) return true;

    const roomMember = room.members?.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    if (
      roomMember &&
      (roomMember.role === "owner" ||
        roomMember.role === "teacher" ||
        roomMember.role === "leader")
    ) {
      return true;
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) return false;

    const channelMember = channel.members?.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );

    return (
      !!channelMember &&
      (channelMember.role === "vice" || channelMember.role === "assistant")
    );
  }

  /**
   * Cập nhật vai trò thành viên trong Kênh (Phó nhóm / Ban cán sự / Thành viên)
   */
  async updateChannelMemberRole(
    userId: string,
    roomId: string,
    channelId: string,
    targetUserId: string,
    newRole: string,
  ): Promise<RoomResponse> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const canManage = await this.canManageChannelMembers(room, channelId, userId);
    if (!canManage) {
      throw new ForbiddenException("Bạn không có quyền quản lý vai trò trong kênh này");
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException("Không thể thay đổi vai trò của Chủ phòng / Giảng viên trong kênh");
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException("Kênh không tồn tại");

    if (!channel.members) channel.members = [];

    // Kiểm tra giới hạn tối đa 3 Phó nhóm / Ban cán sự cho từng Kênh (không đếm Giảng viên / Trưởng nhóm)
    if (newRole === "vice" || newRole === "assistant") {
      const currentViceCount = channel.members.filter(
        (m) =>
          (m.role === "vice" || m.role === "assistant") &&
          m.userId !== targetUserId &&
          m.userId !== room.ownerId,
      ).length;
      if (currentViceCount >= 3) {
        const subTitle = room.type === "classroom" ? "Ban cán sự" : "Phó nhóm";
        throw new BadRequestException(`Đã đạt số lượng tối đa 3 ${subTitle}`);
      }
    }

    const existing = channel.members.find((m) => m.userId === targetUserId);
    if (existing) {
      existing.role = newRole;
    } else {
      channel.members.push({ userId: targetUserId, role: newRole });
    }

    room.markModified("channels");
    await room.save();

    try {
      this.roomsGateway?.notifyRoomUpdated(roomId, {
        type: "member_role_updated",
        roomId,
        channelId,
        targetUserId,
      });
    } catch (e) {
      this.logger.warn("Không thể phát tín hiệu socket notifyRoomUpdated:", e);
    }

    return this.mapToRoomResponse(room);
  }

  /**
   * Thêm thành viên vào Kênh riêng tư (bằng targetUserId hoặc emailOrUsername)
   */
  async addChannelMember(
    userId: string,
    roomId: string,
    channelId: string,
    targetUserId?: string,
    emailOrUsername?: string,
  ): Promise<RoomResponse> {
    const queries = [targetUserId?.trim(), emailOrUsername?.trim()].filter(
      Boolean,
    ) as string[];
    if (queries.length === 0) {
      throw new BadRequestException("Vui lòng nhập email hoặc tên tài khoản");
    }

    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const canManage = await this.canManageChannelMembers(room, channelId, userId);
    if (!canManage) {
      throw new ForbiddenException("Chỉ Trưởng nhóm/Giảng viên hoặc Phó nhóm/Ban cán sự của kênh mới có quyền thêm thành viên vào kênh riêng tư");
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException("Kênh không tồn tại");

    // Tra cứu thông tin người dùng trong UserModel với $or tập hợp tất cả các trường
    const orConditions: any[] = [];
    for (const q of queries) {
      orConditions.push({ email: q.toLowerCase() });
      orConditions.push({ username: q });
      orConditions.push({ displayName: q });
      orConditions.push({ supabaseId: q });
      if (Types.ObjectId.isValid(q)) {
        orConditions.push({ _id: new Types.ObjectId(q) });
      }
    }

    const targetUser = await this.userModel
      .findOne({
        $or: orConditions,
        isDeleted: { $ne: true },
      })
      .exec();

    if (!targetUser) {
      throw new NotFoundException("Không tìm thấy người dùng.");
    }

    if (targetUser.status === "BLOCKED" || (targetUser as any).isBlocked) {
      throw new BadRequestException("Tài khoản đã bị khóa hoặc bị xóa.");
    }

    const targetIds = new Set<string>();
    if (targetUser.supabaseId) targetIds.add(targetUser.supabaseId);
    if (targetUser._id) targetIds.add(targetUser._id.toString());
    const resolvedSubId = targetUser.supabaseId || targetUser._id.toString();

    if (targetIds.has(userId)) {
      throw new BadRequestException("Không thể tự thêm chính mình.");
    }

    // 1. Kiểm tra & tự động thêm vào phòng họp/lớp học nếu chưa phải thành viên
    if (!room.members) room.members = [];
    const existingRoomMember = room.members.find((m) => targetIds.has(m.userId));
    if (!existingRoomMember) {
      room.members.push({
        userId: resolvedSubId,
        role: "member",
        joinedAt: new Date(),
        status: "ACTIVE",
        isLeft: false,
      } as any);
      room.markModified("members");
    } else if (
      existingRoomMember.isLeft ||
      existingRoomMember.status === "REMOVED" ||
      existingRoomMember.status === "LEFT"
    ) {
      existingRoomMember.isLeft = false;
      existingRoomMember.status = "ACTIVE";
      existingRoomMember.rejoinedAt = new Date();
      room.markModified("members");
    }

    // 2. Kiểm tra thành viên trong Kênh riêng tư
    if (!channel.members) channel.members = [];
    const existingCM = channel.members.find((m) => targetIds.has(m.userId));
    if (existingCM) {
      if (
        existingCM.isLeft !== true &&
        existingCM.status !== "REMOVED" &&
        existingCM.status !== "LEFT"
      ) {
        throw new BadRequestException("Thành viên đã tồn tại trong kênh.");
      }
      existingCM.isLeft = false;
      existingCM.status = "JOINED";
      existingCM.role = "member";
      delete existingCM.leftAt;
    } else {
      channel.members.push({
        userId: resolvedSubId,
        role: "member",
        isLeft: false,
        status: "JOINED",
      });
    }
    room.markModified("channels");

    await room.save();

    try {
      this.roomsGateway?.notifyRoomUpdated(roomId, {
        type: "member_role_updated",
        roomId,
        channelId,
        targetUserId: resolvedSubId,
      });
    } catch (e) {
      this.logger.warn("Không thể phát tín hiệu socket notifyRoomUpdated:", e);
    }

    return this.mapToRoomResponse(room);
  }

  /**
   * Xóa thành viên khỏi Kênh riêng tư (Xóa mềm - Soft Delete)
   */
  async removeChannelMember(
    userId: string,
    roomId: string,
    channelId: string,
    targetUserId: string,
  ): Promise<RoomResponse> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    if (!this.canManageChannelMembers(room, channelId, userId)) {
      throw new ForbiddenException("Chỉ Trưởng nhóm/Giảng viên hoặc Phó nhóm/Ban cán sự của kênh mới có quyền xóa thành viên khỏi kênh riêng tư");
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException("Không thể xóa Chủ phòng / Giảng viên khỏi kênh");
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException("Kênh không tồn tại");

    if (channel.members) {
      const targetMember = channel.members.find((m) => m.userId === targetUserId);
      if (targetMember) {
        targetMember.isLeft = true;
        targetMember.status = "REMOVED";
        targetMember.leftAt = new Date();
        room.markModified("channels");
        await room.save();
      }
    }

    try {
      this.roomsGateway?.notifyRoomUpdated(roomId, {
        type: "channel_member_removed",
        roomId,
        channelId,
        targetUserId,
      });
    } catch (e) {
      this.logger.warn("Không thể phát tín hiệu socket notifyRoomUpdated:", e);
    }

    return this.mapToRoomResponse(room);
  }

  /**
   * Tự động chuyển đổi các vai trò cũ (student, teacher, assistant, leader) về 3 vai trò chuẩn ('owner', 'vice', 'member')
   */
  private sanitizeMemberRoles(room: RoomDocument) {
    if (room.members && Array.isArray(room.members)) {
      room.members.forEach((m) => {
        if (m.role === "student") m.role = "member";
        else if (m.role === "teacher" || m.role === "leader") m.role = "owner";
        else if (m.role === "assistant" || m.role === "vice_leader") m.role = "vice";
      });
      room.markModified("members");
    }

    if (room.channels && Array.isArray(room.channels)) {
      room.channels.forEach((c) => {
        if (c.members && Array.isArray(c.members)) {
          c.members.forEach((cm) => {
            if (cm.role === "student") cm.role = "member";
            else if (cm.role === "teacher" || cm.role === "leader") cm.role = "owner";
            else if (cm.role === "assistant" || cm.role === "vice_leader") cm.role = "vice";
          });
        }
      });
      room.markModified("channels");
    }
  }

  /**
   * Bộ chuyển đổi: Mongoose Document -> RoomResponse chuẩn
   * Đảm bảo đồng bộ kiểu dữ liệu với frontend, tránh lộ thông tin nhạy cảm
   */
  private mapToRoomResponse(room: RoomDocument): RoomResponse {
    // Chuyển Mongoose Document thành plain JavaScript Object
    const plainRoom = room.toObject ? room.toObject() : (room as any);

    const safeToIsoString = (val: any): string => {
      if (!val) return new Date().toISOString();
      if (val instanceof Date) return val.toISOString();
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    };

    return {
      _id: plainRoom._id?.toString() || "",
      name: plainRoom.name || "",
      type: (plainRoom.type || "meeting") as "meeting" | "classroom",
      code: plainRoom.code || "",
      ownerId: plainRoom.ownerId || "",
      // Ánh xạ channels (nếu có id sinh tự động thì chuyển sang string)
      channels: plainRoom.channels || [],
      // Ánh xạ members cơ bản (chỉ lấy những thành viên đang hoạt động)
      members: plainRoom.members
        ?.filter((m: RoomMember) => m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT")
        .map((m: RoomMember) => {
          const normalized = normalizeRole(m.role || "member");
          return {
            userId: m.userId,
            role: normalized,
            displayRole: getDisplayRole(normalized, plainRoom.type),
            joinedAt: safeToIsoString(m.joinedAt),
          };
        }) || [],
      createdAt: safeToIsoString(plainRoom.createdAt),
      updatedAt: safeToIsoString(plainRoom.updatedAt),
    };
  }
}
