import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Room, RoomDocument } from "./schemas/room.schema";
import { CreateRoomDto } from "./dto/create-room.dto";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  RoomActivity,
  RoomActivityDocument,
} from "./schemas/room-activity.schema";
import {
  ErrorCode,
  RoomMemberResponse,
  RoomResponse,
} from "@tobomeet/shared/types";
import { RoomMember } from "./schemas/room-member.schema";
import { RoomsGateway } from "./rooms.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getDisplayRole, normalizeRole } from "./helpers/room-role.helper";

/*
  Covention (tuân thủ tuyệt đối, không được cãi, nếu có làm khác thì cảnh báo ngay lập tức):
  1) Các service nào không trả về dữ liệu thì không return {message: ""} hoặc tương tự
  2) Tất cả các service nào trả về dữ liệu là object thì định nghĩa type riêng
  3) Nếu có các Promise có thể chạy song song thì dùng Promise.all hay 3 cái còn lại tuỳ trường hợp để tối ưu hiệu năng
  4) Chỉ có 3 role duy nhất là owner, admin, member
  5) Nếu có user thì chỉ dùng nguồn id duy nhất từ supabaseId (token), cấm dùng _id của mongo (bỏ fallback)
  6) Không xoá mềm ở cấp độ kênh, chỉ xoá mềm ở cấp độ phòng
*/
@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RoomActivity.name)
    private activityModel: Model<RoomActivityDocument>,
    private readonly roomsGateway: RoomsGateway,
  ) {}

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
            status: { $nin: ["removed", "left"] },
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

    const activeMembers = room.members.filter(
      (member) => member.status !== "removed" && member.status !== "left",
    );
    const memberUserIds = activeMembers.map((member) => member.userId);
    const users = await this.userModel
      .find({ supabaseId: { $in: memberUserIds } })
      .exec();

    // Định nghĩa thứ tự ưu tiên vai trò: owner (1) -> vice (2) -> member (3)
    const rolePriorityMap: Record<string, number> = {
      owner: 1,
      admin: 2,
      member: 3,
    };

    // Sắp xếp thành viên theo thứ tự ưu tiên
    activeMembers.sort((a, b) => {
      const pA = rolePriorityMap[a.role] || 99;
      const pB = rolePriorityMap[b.role] || 99;
      return pA - pB;
    });

    const data: RoomMemberResponse[] = activeMembers.map((member) => {
      const userInfo = users.find(
        (u) =>
          u.supabaseId === member.userId || u._id.toString() === member.userId,
      );
      const normalized = normalizeRole(member.role);

      return {
        userId: member.userId,
        role: normalized,
        displayRole: getDisplayRole(normalized, room.type),
        status: member.status as "active" | "removed" | "left" | undefined,
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
  async removeMember(
    roomId: string,
    targetUserId: string,
    operatorId: string,
  ): Promise<void> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Không tìm thấy phòng");

    // Lấy thông tin người thực hiện thao tác (operator)
    const operatorMember = room.members.find(
      (m) =>
        m.userId === operatorId &&
        m.status !== "removed" &&
        m.status !== "left",
    );
    if (!operatorMember) throw new BadRequestException("Không phải thành viên");

    const opRole = normalizeRole(operatorMember.role);
    const isOwner = opRole === "owner";

    // Kiểm tra quyền Admin ở kênh công khai
    const hasPublicChannelAdminRole = room.channels?.some(
      (channel) =>
        !channel.isPrivate &&
        channel.members?.some(
          (cm) => cm.userId === operatorId && cm.role === "admin",
        ),
    );

    const isSubRole = opRole === "admin" || hasPublicChannelAdminRole;

    if (!isOwner && !isSubRole) {
      throw new ForbiddenException("Hành động bị cấm");
    }

    // Lấy thông tin người bị xóa (target)
    const targetMember = room.members.find(
      (m) =>
        m.userId === targetUserId &&
        m.status !== "removed" &&
        m.status !== "left",
    );
    if (!targetMember) throw new NotFoundException("Không tìm thấy người dùng");

    const targetRole = normalizeRole(targetMember.role);

    // Trưởng phòng không thể bị xóa
    if (targetRole === "owner") {
      throw new BadRequestException("Không thể xoá trưởng phòng");
    }

    // Phó phòng không được xóa Trưởng phòng/Ban quản trị khác
    const isTargetAdminChannelLevel = room.channels?.some(
      (channel) =>
        !channel.isPrivate &&
        channel.members?.some(
          (cm) => cm.userId === targetUserId && cm.role === "admin",
        ),
    );
    const isTargetAdmin = targetRole === "admin" || isTargetAdminChannelLevel;

    if (isSubRole && isTargetAdmin) {
      throw new ForbiddenException("Hành động bị cấm");
    }

    targetMember.status = "removed";
    targetMember.removedBy = operatorId;
    targetMember.removedAt = new Date();
    room.markModified("members");

    const [operatorUser, targetUser] = await Promise.all([
      this.userModel.findOne({ supabaseId: operatorId }),
      this.userModel.findOne({ supabaseId: targetUserId }),
      room.save(),
    ]);

    await this.activityModel.create({
      roomId,
      type: "MEMBER_REMOVED",
      metadata: {
        userId: operatorId,
        targetUserId,
        details: `${operatorUser?.displayName || "Chủ phòng"} đã xóa ${targetUser?.displayName || "Thành viên"} khỏi phòng.`,
      },
    });

    this.eventEmitter.emit("notification.kicked", {
      userId: targetUserId,
      metadata: {
        roomId,
        roomName: room.name,
        kickedAt: new Date().toISOString(),
      },
    });

    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "member_removed",
      removedUserId: targetUserId,
      roomId,
      roomName: room.name,
    });
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
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const operatorUserDoc = await this.userModel
      .findOne({ supabaseId: operatorId })
      .exec();

    const allowedOperatorIds = new Set<string>([operatorId]);
    if (operatorUserDoc?.supabaseId)
      allowedOperatorIds.add(operatorUserDoc.supabaseId);
    if (operatorUserDoc?._id)
      allowedOperatorIds.add(operatorUserDoc._id.toString());

    const operatorMember = room.members.find(
      (m) =>
        allowedOperatorIds.has(m.userId) &&
        m.status !== "remove" &&
        m.status !== "left",
    );
    if (!operatorMember) {
      throw new ForbiddenException("Bạn không phải thành viên của phòng này");
    }

    const opRole = normalizeRole(operatorMember.role);
    if (opRole !== "owner") {
      const ownerTitle =
        room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
      throw new ForbiddenException(
        `Chỉ ${ownerTitle} mới có quyền thay đổi vai trò thành viên`,
      );
    }

    const newRole = normalizeRole(rawNewRole);
    if (!["admin", "member"].includes(newRole)) {
      throw new BadRequestException("Vai trò không hợp lệ");
    }

    const targetUserDoc = await this.userModel
      .findOne({ supabaseId: targetUserId })
      .exec();

    const targetIds = new Set<string>([targetUserId]);
    if (targetUserDoc?.supabaseId) targetIds.add(targetUserDoc.supabaseId);
    if (targetUserDoc?._id) targetIds.add(targetUserDoc._id.toString());

    // 2. Tìm thành viên bị thay đổi
    const targetIdx = room.members.findIndex(
      (m) =>
        targetIds.has(m.userId) && m.status !== "remove" && m.status !== "left",
    );
    if (targetIdx === -1) {
      throw new NotFoundException("Thành viên không tồn tại trong phòng");
    }

    const targetMember = room.members[targetIdx];

    // Không được tự đổi vai trò của chính mình qua API này
    if (targetIds.has(operatorId) || allowedOperatorIds.has(targetUserId)) {
      throw new BadRequestException(
        "Bạn không thể tự thay đổi vai trò của chính mình",
      );
    }

    const oldRole = normalizeRole(targetMember.role);
    if (oldRole === "owner") {
      const ownerTitle =
        room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
      throw new BadRequestException(
        `Không thể thay đổi vai trò của ${ownerTitle} bằng chức năng này`,
      );
    }

    // 3. Kiểm tra giới hạn số lượng (Tối đa 3 Phó nhóm / Ban cán sự)
    if (newRole === "admin" && oldRole !== "admin") {
      const viceCount = room.members.filter(
        (m) =>
          normalizeRole(m.role) === "admin" &&
          m.status !== "remove" &&
          m.status !== "left",
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
    const operatorUser = await this.userModel.findOne({
      supabaseId: operatorId,
    });
    const targetUser = await this.userModel.findOne({
      supabaseId: targetUserId,
    });
    const opName = operatorUser?.displayName || "Người dùng";
    const tarName = targetUser?.displayName || "Thành viên";
    const subTitle = room.type === "classroom" ? "Ban cán sự" : "Phó nhóm";

    let message = "";
    if (newRole === "admin") {
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

    return {
      message,
      role: newRole,
      displayRole: getDisplayRole(newRole, room.type),
    };
  }

  /**
   * Chuyển quyền chủ phòng (owner) sang người khác, chỉ chủ phòng hiện tại mới được phép thực hiện
   */
  async transferOwner(
    roomId: string,
    newOwnerId: string,
    operatorId: string,
  ): Promise<void> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    if (operatorId === newOwnerId) {
      throw new BadRequestException("Không thể chuyển quyền cho chính mình");
    }

    // Xác thực người chuyển quyền (phải là Owner)
    const operatorMember = room.members.find(
      (m) =>
        m.userId === operatorId && m.status !== "remove" && m.status !== "left",
    );
    if (!operatorMember)
      throw new ForbiddenException(
        "Bạn không phải là thành viên của phòng này",
      );

    if (normalizeRole(operatorMember.role) !== "owner") {
      throw new ForbiddenException("Chỉ chủ phòng mới có quyền chuyển quyền");
    }

    // Xác thực người nhận quyền (phải đang là thành viên)
    const newOwnerIdx = room.members.findIndex(
      (m) =>
        m.userId === newOwnerId && m.status !== "remove" && m.status !== "left",
    );
    if (newOwnerIdx === -1) {
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc không còn là thành viên hoạt động",
      );
    }
    const operatorIdx = room.members.findIndex((m) => m.userId === operatorId);

    // Thực hiện chuyển quyền cấp độ Phòng
    room.ownerId = newOwnerId;
    room.members[newOwnerIdx].role = "owner";
    if (operatorIdx !== -1) {
      room.members[operatorIdx].role = "member";
    }

    // Xử lý đồng bộ quyền ở cấp độ Kênh
    if (room.channels && Array.isArray(room.channels)) {
      room.channels.forEach((channel) => {
        if (!channel.members) channel.members = [];

        // Xử lý cho Owner Cũ (Đảm bảo không mất quyền vào kênh Private)
        if (channel.isPrivate) {
          const oldOwnerInChannel = channel.members.find(
            (cm) => cm.userId === operatorId,
          );
          if (!oldOwnerInChannel) {
            channel.members.push({
              userId: operatorId,
              role: "member", // Đẩy xuống làm member
            });
          } else {
            oldOwnerInChannel.role = "member";
          }
        }

        // Vì Owner mới đã có toàn quyền ngầm định, ta xoá sạch họ khỏi mảng ngoại lệ của MỌI KÊNH
        channel.members = channel.members.filter(
          (cm) => cm.userId !== newOwnerId,
        );
      });
      room.markModified("channels");
    }

    room.markModified("members");

    const [operatorUser, newOwnerUser] = await Promise.all([
      this.userModel.findOne({ supabaseId: operatorId }),
      this.userModel.findOne({ supabaseId: newOwnerId }),
      room.save(),
    ]);

    const opName = operatorUser?.displayName || "Người dùng";
    const newOwnerName = newOwnerUser?.displayName || "Thành viên";
    const message = `${opName} đã chuyển quyền Chủ phòng cho ${newOwnerName}.`;

    await this.activityModel.create({
      roomId,
      type: "OWNER_TRANSFERRED",
      metadata: {
        userId: operatorId,
        actorId: operatorId,
        actorName: opName,
        targetUserId: newOwnerId,
        targetUserName: newOwnerName,
        oldRole: "owner",
        newRole: "owner",
        details: message,
        roomType: room.type,
      },
    });

    const updatedRoomPayload = this.mapToRoomResponse(room);
    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "ownership_transferred",
      roomId,
      previousOwnerId: operatorId,
      newOwnerId,
      room: updatedRoomPayload,
    });
  }

  /**
   * Tham gia phòng bằng mã code
   */
  async joinRoom(userId: string, roomCode: string): Promise<RoomResponse> {
    const room = await this.roomModel.findOne({
      code: roomCode,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Không tìm thấy phòng với mã này");

    // Ràng buộc 1: Giới hạn 100 thành viên
    if (room.members.length >= 100) {
      throw new BadRequestException("Phòng đã đạt số lượng tối đa (100 người)");
    }

    const requesterDoc = await this.userModel
      .findOne({ supabaseId: userId })
      .exec();

    const allowedRequesterIds = new Set<string>([userId]);
    if (requesterDoc?.supabaseId)
      allowedRequesterIds.add(requesterDoc.supabaseId);
    if (requesterDoc?._id) allowedRequesterIds.add(requesterDoc._id.toString());
    const resolvedUserId = requesterDoc?.supabaseId || userId;

    // Ràng buộc 2: Kiểm tra trùng lặp
    const isAlreadyMember = room.members.some(
      (member) =>
        allowedRequesterIds.has(member.userId) &&
        member.status !== "remove" &&
        member.status !== "left",
    );
    if (isAlreadyMember) {
      throw new BadRequestException("Bạn đã là thành viên của phòng này");
    }

    // Nếu từng bị xóa bởi chủ phòng (status === "remove"), không cho tự tham gia lại
    const removedMember = room.members.find(
      (m) => allowedRequesterIds.has(m.userId) && m.status === "remove",
    );
    if (removedMember) {
      throw new ForbiddenException(
        "Bạn không thể tự tham gia lại phòng này do đã bị Trưởng nhóm xóa.",
      );
    }

    // Kiểm tra xem trước đó từng là thành viên và đã rời phòng (left)
    const previousMemberIndex = room.members.findIndex(
      (member) =>
        allowedRequesterIds.has(member.userId) && member.status === "left",
    );

    const now = new Date();
    let joinedAtDate = now;
    let rejoinedAtDate: Date | undefined = undefined;

    if (previousMemberIndex !== -1) {
      room.members[previousMemberIndex].status = "active";
      room.members[previousMemberIndex].rejoinedAt = new Date();
      room.members[previousMemberIndex].userId = resolvedUserId; // Đồng bộ hóa ID

      joinedAtDate = room.members[previousMemberIndex].joinedAt;
      rejoinedAtDate = now;

      room.markModified("members");
    } else {
      // Thêm member mới với vai trò chuẩn 'member' dưới DB
      room.members.push({
        userId: resolvedUserId,
        role: "member",
        joinedAt: new Date(),
        status: "active",
      });
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
      // status: "active",
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
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });

    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    return room;
  }

  async getRoomByIdForUser(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    if (room.status === "blocked") {
      throw new ForbiddenException(
        "Phòng họp này đang bị tạm khóa do vi phạm quy định cộng đồng.",
      );
    }

    const userDoc = await this.userModel.findOne({ supabaseId: userId }).exec();

    const allowedUserIds = new Set<string>([userId]);
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    const member = room.members.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.status !== "remove" &&
        m.status !== "left",
    );
    if (!member) {
      throw new ForbiddenException("Bạn không còn là thành viên của phòng này");
    }

    // Nếu không phải là Chủ phòng (Owner), chỉ trả về các Kênh Công khai (isPrivate !== true)
    // hoặc Kênh Riêng tư mà người dùng được cấp quyền tham gia trong channel.members (và chưa bị xóa/rời đi)
    if (!allowedUserIds.has(room.ownerId) && room.channels) {
      room.channels = room.channels.filter(
        (c) =>
          !c.isPrivate || c.members?.some((m) => allowedUserIds.has(m.userId)),
      );
    }

    return room;
  }

  /**
   * Kiểm tra người dùng có quyền truy cập kênh chỉ định hay không (Public hoac Private va chua bi xoa)
   */
  async checkChannelAccess(
    roomId: string,
    channelId: string,
    userId: string,
  ): Promise<boolean> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) return false;

    const userDoc = await this.userModel.findOne({ supabaseId: userId }).exec();

    const allowedUserIds = new Set<string>([userId]);
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    if (allowedUserIds.has(room.ownerId)) return true;

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) return false;

    if (!channel.isPrivate) return true;

    const member = channel.members?.find((m) => allowedUserIds.has(m.userId));

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
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });

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

    const newChannel: any = {
      name: channelName.trim(),
      isPrivate: !!isPrivate,
      createdAt: new Date(),
    };

    // Khi tạo kênh riêng tư, chỉ thêm những thành viên được mời ban đầu (initialMemberIds)
    // Người tạo (Owner) có quyền ngầm định từ room.ownerId nên KHÔNG CẦN lưu vào đây.
    if (isPrivate) {
      const memberIds = Array.from(new Set(initialMemberIds)).filter(
        (id) => id !== userId,
      );

      newChannel.members = memberIds.map((id) => ({
        userId: id,
        role: "member",
      }));
    }

    room.channels.push(newChannel);
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
      $or: [...(isObjectId ? [{ _id: roomId }] : []), { code: roomId }],
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const requesterUserDoc = await this.userModel
      .findOne({ supabaseId: userId })
      .exec();

    const allowedRequesterIds = new Set<string>([userId]);
    if (requesterUserDoc?.supabaseId)
      allowedRequesterIds.add(requesterUserDoc.supabaseId);
    if (requesterUserDoc?._id)
      allowedRequesterIds.add(requesterUserDoc._id.toString());

    const requesterMember = room.members.find(
      (m) =>
        allowedRequesterIds.has(m.userId) &&
        m.status !== "remove" &&
        m.status !== "left",
    );

    const isOwner =
      room.ownerId === userId || allowedRequesterIds.has(room.ownerId);
    const isRequesterMember = isOwner || !!requesterMember;
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

    const targetIds = new Set<string>();
    if (targetUser.supabaseId) targetIds.add(targetUser.supabaseId);
    if (targetUser._id) targetIds.add(targetUser._id.toString());
    const resolvedTargetId = targetUser.supabaseId || targetUser._id.toString();

    // Kiểm tra xem đã là thành viên (hoặc Chủ phòng) hay chưa
    const isAlreadyMember =
      room.ownerId === resolvedTargetId ||
      targetIds.has(room.ownerId) ||
      room.members.some(
        (m) =>
          targetIds.has(m.userId) &&
          m.status !== "remove" &&
          m.status !== "left",
      );
    if (isAlreadyMember) {
      throw new BadRequestException("Thành viên này đã ở trong phòng họp");
    }

    // Nếu trước đó đã rời phòng hoặc bị xóa, reset isLeft và update rejoinedAt
    const previousMemberIdx = room.members.findIndex(
      (m) =>
        targetIds.has(m.userId) &&
        (m.status === "remove" || m.status === "left"),
    );

    if (previousMemberIdx !== -1) {
      const prevMember = room.members[previousMemberIdx];
      // Nếu trạng thái trước đó là remove (bị xóa khỏi phòng), chỉ cho phép owner hoặc vice thêm lại
      if (prevMember.status === "remove") {
        const opRole = requesterMember
          ? normalizeRole(requesterMember.role)
          : null;
        const isHighRole = isOwner || opRole === "owner";

        // Kiểm tra quyền Phó nhóm ở kênh công khai
        const hasPublicChannelViceRole = room.channels?.some(
          (channel) =>
            channel.isPrivate !== true &&
            channel.members?.some(
              (cm) =>
                allowedRequesterIds.has(cm.userId) &&
                (cm.role === "vice" ||
                  cm.role === "assistant" ||
                  cm.role === "vice_leader"),
            ),
        );

        const isOwnerOrVice =
          isHighRole || opRole === "admin" || hasPublicChannelViceRole;

        if (!isOwnerOrVice) {
          throw new ForbiddenException(
            "Thành viên này từng bị xóa khỏi phòng. Chỉ Trưởng nhóm hoặc Phó nhóm mới có quyền thêm lại.",
          );
        }
      }

      room.members[previousMemberIdx].status = "active";
      room.members[previousMemberIdx].rejoinedAt = new Date();
      room.members[previousMemberIdx].userId = resolvedTargetId; // Đồng bộ hóa ID
      room.markModified("members");
    } else {
      // Giới hạn 100 thành viên
      if (room.members.length >= 100) {
        throw new BadRequestException(
          "Phòng đã đạt số lượng tối đa (100 người)",
        );
      }
      // Thêm thành viên với vai trò chuẩn 'member' dưới DB
      room.members.push({
        userId: resolvedTargetId,
        role: "member",
        joinedAt: new Date(),
        status: "active",
      });
    }

    this.sanitizeMemberRoles(room);

    try {
      await room.save();
    } catch (err: any) {
      this.logger.error("Lỗi khi lưu thông tin thành viên vào phòng:", err);
      throw new BadRequestException(
        err?.message || "Không thể thêm thành viên vào phòng",
      );
    }

    // Phát tín hiệu realtime an toàn
    try {
      this.roomsGateway?.notifyRoomUpdated(room._id.toString(), {
        type: "member_added",
        addedUserId: resolvedTargetId,
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
  async leaveRoom(
    roomId: string,
    userId: string,
    newOwnerId?: string,
  ): Promise<void> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException(ErrorCode.ROOM_NOT_FOUND);

    // Tìm index của người rời đi (phải đảm bảo họ đang active)
    const memberIdx = room.members.findIndex(
      (m) =>
        m.userId === userId && m.status !== "remove" && m.status !== "left",
    );
    if (memberIdx === -1) {
      throw new BadRequestException(ErrorCode.NOT_A_MEMBER);
    }

    const member = room.members[memberIdx];

    if (member.role === "owner") {
      // Lọc ra những người CÒN ĐANG HOẠT ĐỘNG trong phòng (bỏ qua những người đã rời/bị xoá)
      const activeMembers = room.members.filter(
        (m) => m.status !== "remove" && m.status !== "left",
      );

      // Trường hợp 1: Phòng chỉ có duy nhất chủ phòng ĐANG HOẠT ĐỘNG -> Giải tán phòng
      if (activeMembers.length === 1) {
        room.status = "disbanded";
        room.isDeleted = true;
        await room.save();
        return;
      }

      // Trường hợp 2: Có thành viên khác nhưng chưa chỉ định người kế nhiệm
      if (!newOwnerId) {
        throw new BadRequestException(ErrorCode.FORBIDDEN_ACTION); // Cần chỉ định Owner mới
      }

      // Kiểm tra người nhận quyền có tồn tại và đang active không
      const newOwnerIndex = room.members.findIndex(
        (m) =>
          m.userId === newOwnerId &&
          m.status !== "remove" &&
          m.status !== "left",
      );
      if (newOwnerIndex === -1) {
        throw new BadRequestException(ErrorCode.USER_NOT_FOUND);
      }

      // Thực hiện chuyển giao quyền sở hữu
      room.ownerId = newOwnerId;
      room.members[newOwnerIndex].role = "owner";
    }

    if (room.channels && Array.isArray(room.channels)) {
      room.channels.forEach((channel) => {
        if (channel.members) {
          channel.members = channel.members.filter(
            (cm) =>
              // Xóa cứng người rời phòng khỏi tất cả các kênh để dọn rác
              cm.userId !== userId &&
              // Nếu có Chủ phòng mới, xóa luôn họ (vì họ đã có quyền ngầm định toàn phòng)
              (!newOwnerId || cm.userId !== newOwnerId),
          );
        }
      });
      room.markModified("channels");
    }

    // Đánh dấu thành viên rời đi (ở cấp độ Phòng)
    room.members[memberIdx].status = "left";
    room.markModified("members");
    await room.save();

    // Phát tín hiệu realtime
    this.roomsGateway.notifyRoomUpdated(roomId, {
      type: "member_left",
      leftUserId: userId,
      newOwnerId: newOwnerId || null,
      roomId,
    });
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
    this.eventEmitter.emit("notification.room_disbanded", {
      userIds: room.members
        .filter((m) => m.status !== "remove" && m.status !== "left") // không thông báo cho người bị xoá hoặc đã rời
        .map((m) => m.userId) // chỉ lấy id
        .filter((id) => id !== userId), // loại trừ người thực hiện
      metadata: {
        roomId: roomId,
        roomName: room.name,
      },
    });
  }

  /**
   * Lấy thông tin sơ bộ của phòng bằng mã code
   */
  async getRoomByCode(code: string) {
    const room = await this.roomModel.findOne({
      code: code.trim(),
      isDeleted: { $ne: true },
    });
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
          status: { $nin: ["remove", "left"] }, // Trạng thái không phải là đã bị xóa hoặc đã rời
        },
      },
    });

    return !!isExist;
  }

  /**
   * Kiểm tra người dùng đã là thành viên của phòng hay chưa (bằng Mã phòng - Code)
   */
  async checkUserInRoomByCode(
    roomCode: string,
    userId: string,
  ): Promise<boolean> {
    const isExist = await this.roomModel.exists({
      code: roomCode.trim(),
      isDeleted: { $ne: true },
      members: {
        $elemMatch: {
          userId: userId,
          isLeft: { $ne: true },
          status: { $nin: ["remove", "left"] },
        },
      },
    });

    return !!isExist;
  }

  /**
   * Kiểm tra xem người dùng có quyền quản lý thành viên / phân quyền trong Kênh hay không
   */
  async canManageChannelMembers(
    room: RoomDocument,
    channelId: string,
    userId: string,
  ): Promise<boolean> {
    const userDoc = await this.userModel.findOne({ supabaseId: userId }).exec();

    const allowedUserIds = new Set<string>([userId]);
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    if (allowedUserIds.has(room.ownerId)) return true;

    const roomMember = room.members?.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.status !== "remove" &&
        m.status !== "left",
    );

    // Chủ phòng mới có full quyền mặc định
    if (roomMember && roomMember.role === "owner") {
      return true;
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) return false;

    const channelMember = channel.members?.find((m) =>
      allowedUserIds.has(m.userId),
    );

    // Chỉ có admin kênh mới có quyền quản lý kênh đó
    return !!channelMember && channelMember.role === "admin";
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
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    const canManage = await this.canManageChannelMembers(
      room,
      channelId,
      userId,
    );
    if (!canManage) {
      throw new ForbiddenException(
        "Bạn không có quyền quản lý vai trò trong kênh này",
      );
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException(
        "Không thể thay đổi vai trò của Chủ phòng / Giảng viên trong kênh",
      );
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException("Kênh không tồn tại");

    if (!channel.members) channel.members = [];

    // Kiểm tra giới hạn tối đa 3 Phó nhóm / Ban cán sự cho từng Kênh
    if (newRole === "admin") {
      const currentAdminCount = channel.members.filter(
        (m) =>
          m.role === "admin" &&
          m.userId !== targetUserId &&
          m.userId !== room.ownerId,
      ).length;
      if (currentAdminCount >= 3) {
        const subTitle = room.type === "classroom" ? "Ban cán sự" : "Phó nhóm";
        throw new BadRequestException(`Đã đạt số lượng tối đa 3 ${subTitle}`);
      }
    }

    // Xử lý lưu hoặc xoá khỏi mảng dựa trên loại kênh và quyền
    if (!channel.isPrivate && newRole === "member") {
      // Xoá hẳn user này khỏi danh sách ngoại lệ của kênh để tiết kiệm DB.
      channel.members = channel.members.filter(
        (m) => m.userId !== targetUserId,
      );
    } else {
      // Đối với kênh Private, HOẶC bổ nhiệm làm 'admin' trong kênh Public
      const existing = channel.members.find((m) => m.userId === targetUserId);
      if (existing) {
        existing.role = newRole;
      } else {
        channel.members.push({ userId: targetUserId, role: newRole } as any);
      }
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
   * Thêm thành viên vào Kênh riêng tư (Chỉ dùng targetUserId)
   */
  async addChannelMember(
    userId: string,
    roomId: string,
    channelId: string,
    targetUserId: string,
  ): Promise<RoomResponse> {
    if (!targetUserId || !targetUserId.trim()) {
      throw new BadRequestException(ErrorCode.BAD_REQUEST);
    }

    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException(ErrorCode.ROOM_NOT_FOUND);

    // Kiểm tra quyền của người thực hiện
    const canManage = await this.canManageChannelMembers(
      room,
      channelId,
      userId,
    );
    if (!canManage) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN_ACTION);
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException(ErrorCode.ROOM_NOT_FOUND); // Hoặc CHANNEL_NOT_FOUND

    // Tra cứu thông tin người dùng được mời (Chỉ dùng supabaseId)
    const targetUser = await this.userModel
      .findOne({
        supabaseId: targetUserId.trim(),
        isDeleted: { $ne: true },
      })
      .exec();

    if (!targetUser) {
      throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
    }

    if (targetUser.status === "BLOCKED" || (targetUser as any).isBlocked) {
      throw new BadRequestException(ErrorCode.FORBIDDEN_ACTION);
    }

    const resolvedTargetId = targetUser.supabaseId; // Lấy ID duy nhất chuẩn Convention
    if (resolvedTargetId === userId) {
      throw new BadRequestException(ErrorCode.FORBIDDEN_ACTION); // Không tự thêm chính mình
    }

    // Xử lý cấp độ Phòng: Tự động thêm vào phòng họp/lớp học nếu chưa phải thành viên
    if (!room.members) room.members = [];
    const existingRoomMember = room.members.find(
      (m) => m.userId === resolvedTargetId,
    );

    if (!existingRoomMember) {
      room.members.push({
        userId: resolvedTargetId,
        role: "member",
        joinedAt: new Date(),
        status: "active",
      });
      room.markModified("members");
    } else if (
      existingRoomMember.status === "remove" ||
      existingRoomMember.status === "left"
    ) {
      // Phục hồi trạng thái nếu đã từng rời/bị xóa khỏi phòng
      existingRoomMember.status = "active";
      existingRoomMember.rejoinedAt = new Date();
      room.markModified("members");
    }

    // 4. Xử lý cấp độ Kênh (Siêu tối ưu nhờ Xóa cứng)
    if (!channel.members) channel.members = [];
    const existingCM = channel.members.find(
      (m) => m.userId === resolvedTargetId,
    );

    if (existingCM) {
      // Vì là xóa cứng, nếu tìm thấy chắc chắn họ đang ở trong kênh
      throw new BadRequestException(ErrorCode.ALREADY_MEMBER);
    } else {
      channel.members.push({
        userId: resolvedTargetId,
        role: "member",
      });
      room.markModified("channels");
    }

    // 5. Lưu Database và phát tín hiệu
    await room.save();

    try {
      this.roomsGateway?.notifyRoomUpdated(roomId, {
        type: "member_role_updated", // Frontend sẽ bắt case này để cập nhật channel
        roomId,
        channelId,
        targetUserId: resolvedTargetId,
      });
    } catch (e) {
      this.logger.warn("Không thể phát tín hiệu socket notifyRoomUpdated:", e);
    }

    return this.mapToRoomResponse(room);
  }

  /**
   * Xóa thành viên khỏi Kênh riêng tư hoặc xoá quyền ngoại lệ ở Kênh công khai (Xóa cứng - Hard Delete)
   */
  async removeChannelMember(
    userId: string,
    roomId: string,
    channelId: string,
    targetUserId: string,
  ): Promise<void> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    // Kiểm tra quyền thao tác
    const canManage = await this.canManageChannelMembers(
      room,
      channelId,
      userId,
    );
    if (!canManage) {
      throw new ForbiddenException(
        "Bạn không có quyền thực hiện hành động này",
      );
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException("Không thể xóa Chủ phòng khỏi kênh");
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException("Kênh không tồn tại");

    // Định danh vai trò của người thực hiện (Requester) và người bị xóa (Target)
    const isRoomOwner = userId === room.ownerId;
    const roomMember = room.members?.find(
      (m) =>
        m.userId === userId && m.status !== "remove" && m.status !== "left",
    );
    const isRoomLeader =
      isRoomOwner || (roomMember && roomMember.role === "owner");

    if (channel.members) {
      const targetMember = channel.members.find(
        (m) => m.userId === targetUserId,
      );

      if (targetMember) {
        // Ràng buộc của Admin/Phó nhóm: Không được xóa Chủ phòng hoặc Admin khác
        if (!isRoomLeader) {
          if (targetMember.role === "admin") {
            throw new ForbiddenException(
              "Bạn không có quyền thực hiện hành động này",
            );
          }
        }

        // TỐI ƯU: Xóa cứng (Hard Delete) khỏi mảng members của kênh
        channel.members = channel.members.filter(
          (m) => m.userId !== targetUserId,
        );

        room.markModified("channels");
        await room.save();
      }
    }

    this.roomsGateway?.notifyRoomUpdated(roomId, {
      type: "channel_member_removed",
      roomId,
      channelId,
      targetUserId,
    });
  }

  /**
   * Tự động chuyển đổi các vai trò cũ (student, teacher, assistant, leader) về 3 vai trò chuẩn ('owner', 'vice', 'member')
   */
  private sanitizeMemberRoles(room: RoomDocument) {
    if (room.members && Array.isArray(room.members)) {
      room.members.forEach((m) => {
        if (m.role === "student") m.role = "member";
        else if (m.role === "teacher" || m.role === "leader") m.role = "owner";
        else if (m.role === "assistant" || m.role === "vice_leader")
          m.role = "admin";
      });
      room.markModified("members");
    }

    if (room.channels && Array.isArray(room.channels)) {
      room.channels.forEach((c) => {
        if (c.members && Array.isArray(c.members)) {
          c.members.forEach((cm) => {
            if (cm.role === "student") cm.role = "member";
            else if (cm.role === "teacher" || cm.role === "leader")
              cm.role = "owner";
            else if (cm.role === "assistant" || cm.role === "vice_leader")
              cm.role = "admin";
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

    const activeRoomMembers =
      plainRoom.members
        ?.filter(
          (m: RoomMember) => m.status !== "remove" && m.status !== "left",
        )
        .map((m: RoomMember) => {
          const normalized = normalizeRole(m.role || "member");
          return {
            userId: m.userId,
            role: normalized,
            displayRole: getDisplayRole(normalized, plainRoom.type),
            joinedAt: safeToIsoString(m.joinedAt),
          };
        }) || [];

    const mappedChannels =
      plainRoom.channels?.map((c: any) => {
        // Đối với kênh công khai, tự động map toàn bộ thành viên của room làm thành viên kênh
        if (c.isPrivate !== true) {
          const specialMembers = c.members || [];
          const fullMembers = activeRoomMembers.map((rm: any) => {
            const special = specialMembers.find(
              (sm: any) => sm.userId === rm.userId,
            );
            return {
              userId: rm.userId,
              role: special ? special.role : "member",
            };
          });
          return {
            ...c,
            _id: c._id?.toString() || "",
            members: fullMembers,
          };
        }
        return {
          ...c,
          _id: c._id?.toString() || "",
          members: c.members || [],
        };
      }) || [];

    return {
      _id: plainRoom._id?.toString() || "",
      name: plainRoom.name || "",
      type: (plainRoom.type || "meeting") as "meeting" | "classroom",
      code: plainRoom.code || "",
      ownerId: plainRoom.ownerId || "",
      channels: mappedChannels,
      members: activeRoomMembers,
      createdAt: safeToIsoString(plainRoom.createdAt),
      updatedAt: safeToIsoString(plainRoom.updatedAt),
    };
  }
}
