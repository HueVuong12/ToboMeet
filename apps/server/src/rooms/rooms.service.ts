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
import { MeetingsService } from "../meetings/meetings.service";
import { RoomsGateway } from "./rooms.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { getDisplayRole, normalizeRole } from "./helpers/room-role.helper";
import { AppException } from "../core/exceptions/app.exception";

/*
  Covention (tuân thủ tuyệt đối, không được cãi, nếu có làm khác thì cảnh báo ngay lập tức):
  1) Các service nào không trả về dữ liệu thì không return {message: ""} hoặc tương tự
  2) Tất cả các service nào trả về dữ liệu là object thì định nghĩa type riêng
  3) Tất cả các service quăng lỗi thì định nghĩa lỗi riêng trong packages/shared/types/index.ts, VD:
    export const ErrorCode: Record<string, ErrorDetail> = {
      USER_NOT_FOUND: {
        code: 4041,
        message: "Người dùng không tồn tại",
        statusCode: 404,
      },
      ...
    }
    Không trả về message với tham số trong error, để cho FE tự định nghĩa
  4) Nếu có các Promise có thể chạy song song thì dùng Promise.all hay 3 cái còn lại tuỳ trường hợp để tối ưu hiệu năng
  5) Chỉ có 3 role duy nhất là owner, admin, member
  6) Nếu có user thì chỉ dùng nguồn id duy nhất từ supabaseId (token), cấm dùng _id của mongo (bỏ fallback)
*/
@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RoomActivity.name)
    private activityModel: Model<RoomActivityDocument>,
    private readonly roomsGateway: RoomsGateway,
    private readonly meetingsService: MeetingsService,
  ) {}

  /**
   * Tự động chạy Migration cập nhật toàn bộ Role cũ trong MongoDB về 3 role chuẩn: owner, vice, member
   */
  async onModuleInit() {
    try {
      const roomsWithLegacyRoles = await this.roomModel.find({
        "members.role": {
          $in: [
            "teacher",
            "assistant",
            "student",
            "leader",
            "vice_leader",
            "admin",
          ],
        },
      });

      if (roomsWithLegacyRoles.length === 0) {
        this.logger.log(
          "MongoDB RoomMember roles đã ở trạng thái chuẩn hóa (owner, admin, member). Không cần migration.",
        );
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
        `Migration thành công! Đã cập nhật ${updatedMembersCount} bản ghi thành viên trong ${roomsWithLegacyRoles.length} phòng họp/lớp học về 3 role chuẩn: owner, vice, member.`,
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

    const activeMembers = room.members.filter(
      (member) =>
        member.isLeft !== true &&
        member.status !== "REMOVED" &&
        member.status !== "LEFT",
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
        !m.isLeft &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    if (!operatorMember) throw new BadRequestException("Không phải thành viên");

    const opRole = normalizeRole(operatorMember.role);
    const isOwner = opRole === "owner";

    // Kiểm tra quyền Admin ở kênh công khai
    const hasPublicChannelAdminRole = room.channels?.some(
      (channel) =>
        !channel.isPrivate &&
        channel.members?.some(
          (cm) =>
            cm.userId === operatorId &&
            cm.role === "admin" &&
            !cm.isLeft &&
            cm.status !== "REMOVED" &&
            cm.status !== "LEFT",
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
        !m.isLeft &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
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
          (cm) =>
            cm.userId === targetUserId &&
            cm.role === "admin" &&
            !cm.isLeft &&
            cm.status !== "REMOVED" &&
            cm.status !== "LEFT",
        ),
    );
    const isTargetAdmin = targetRole === "admin" || isTargetAdminChannelLevel;

    if (isSubRole && isTargetAdmin) {
      throw new ForbiddenException("Hành động bị cấm");
    }

    targetMember.isLeft = true;
    targetMember.status = "REMOVED";
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
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
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
        targetIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
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
          m.isLeft !== true &&
          m.status !== "REMOVED" &&
          m.status !== "LEFT",
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
   * Chuyển quyền chủ phòng (Giáo viên -> Giáo viên mới, Trưởng nhóm -> Trưởng nhóm mới)
   */
  async transferOwner(roomId: string, newOwnerId: string, operatorId: string) {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    // Resolve operator IDs
    let isOperatorObjectId = false;
    try {
      isOperatorObjectId = Types.ObjectId.isValid(operatorId);
    } catch (_) {}
    const operatorUserDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: operatorId },
          ...(isOperatorObjectId
            ? [{ _id: new Types.ObjectId(operatorId) }]
            : []),
        ],
      })
      .exec();

    const allowedOperatorIds = new Set<string>([operatorId]);
    if (operatorUserDoc?.supabaseId)
      allowedOperatorIds.add(operatorUserDoc.supabaseId);
    if (operatorUserDoc?._id)
      allowedOperatorIds.add(operatorUserDoc._id.toString());

    const operatorMember = room.members.find(
      (m) =>
        allowedOperatorIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    if (!operatorMember) {
      throw new ForbiddenException("Bạn không phải thành viên của phòng này");
    }

    const opRole = normalizeRole(operatorMember.role);
    if (opRole !== "owner") {
      const ownerTitle =
        room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
      throw new ForbiddenException(
        `Chỉ ${ownerTitle} hiện tại mới được phép chuyển quyền ${ownerTitle}`,
      );
    }

    // Resolve new owner IDs
    let isNewOwnerObjectId = false;
    try {
      isNewOwnerObjectId = Types.ObjectId.isValid(newOwnerId);
    } catch (_) {}
    const newOwnerUserDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: newOwnerId },
          ...(isNewOwnerObjectId
            ? [{ _id: new Types.ObjectId(newOwnerId) }]
            : []),
        ],
      })
      .exec();

    const allowedNewOwnerIds = new Set<string>([newOwnerId]);
    if (newOwnerUserDoc?.supabaseId)
      allowedNewOwnerIds.add(newOwnerUserDoc.supabaseId);
    if (newOwnerUserDoc?._id)
      allowedNewOwnerIds.add(newOwnerUserDoc._id.toString());
    const resolvedNewOwnerId = newOwnerUserDoc?.supabaseId || newOwnerId;

    if (
      allowedOperatorIds.has(newOwnerId) ||
      allowedNewOwnerIds.has(operatorId)
    ) {
      throw new BadRequestException(
        "Bạn đang là người nắm giữ quyền hạn cao nhất của phòng này",
      );
    }

    const newOwnerIdx = room.members.findIndex(
      (m) =>
        allowedNewOwnerIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    if (newOwnerIdx === -1) {
      throw new NotFoundException("Người được chọn không tồn tại trong phòng");
    }

    const operatorIdx = room.members.findIndex((m) =>
      allowedOperatorIds.has(m.userId),
    );

    // Chuyển quyền: Owner cũ hạ xuống Member, Người mới thành Owner
    const oldOwnerRole = normalizeRole(operatorMember.role);

    room.ownerId = resolvedNewOwnerId;
    room.members[newOwnerIdx].role = "owner";
    room.members[newOwnerIdx].userId = resolvedNewOwnerId; // Standardize ID
    if (operatorIdx !== -1) {
      room.members[operatorIdx].role = "member";
    }

    // Đảm bảo Owner cũ vẫn còn trong danh sách thành viên của các kênh riêng tư trước khi hạ vai trò
    // (vì khi còn là owner, họ có quyền truy cập ngầm định và không được thêm vào channel.members)
    this.ensureOldOwnerInPrivateChannels(room, operatorId);

    // Reset vai trò của Owner mới trong tất cả các kênh thành member (không chiếm suất vice)
    if (room.channels && Array.isArray(room.channels)) {
      room.channels.forEach((c) => {
        if (c.members && Array.isArray(c.members)) {
          c.members.forEach((cm) => {
            if (allowedNewOwnerIds.has(cm.userId)) {
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
    const operatorUser = await this.userModel.findOne({
      supabaseId: operatorId,
    });
    const newOwnerUser = await this.userModel.findOne({
      supabaseId: newOwnerId,
    });
    const opName = operatorUser?.displayName || "Người dùng";
    const newOwnerName = newOwnerUser?.displayName || "Thành viên";

    const titleRoleName =
      room.type === "classroom" ? "Giảng viên" : "Trưởng nhóm";
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
        member.isLeft !== true &&
        member.status !== "REMOVED" &&
        member.status !== "LEFT",
    );
    if (isAlreadyMember) {
      throw new BadRequestException("Bạn đã là thành viên của phòng này");
    }

    // Nếu từng bị xóa bởi chủ phòng (status === "REMOVED"), không cho tự tham gia lại
    const removedMember = room.members.find(
      (m) => allowedRequesterIds.has(m.userId) && m.status === "REMOVED",
    );
    if (removedMember) {
      throw new ForbiddenException(
        "Bạn không thể tự tham gia lại phòng này do đã bị Trưởng nhóm xóa.",
      );
    }

    // Kiểm tra xem trước đó từng là thành viên và đã rời phòng (LEFT)
    const previousMemberIndex = room.members.findIndex(
      (member) =>
        allowedRequesterIds.has(member.userId) &&
        (member.isLeft === true || member.status === "LEFT"),
    );

    const now = new Date();
    let joinedAtDate = now;
    let rejoinedAtDate: Date | undefined = undefined;

    if (previousMemberIndex !== -1) {
      room.members[previousMemberIndex].isLeft = false;
      room.members[previousMemberIndex].status = "ACTIVE";
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
        status: "ACTIVE",
        isLeft: false,
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

    // Kiểm tra xem người thực hiện có quyền hay không (phải là thành viên hoặc chủ phòng)
    let isRequesterObjectId = false;
    try {
      isRequesterObjectId = Types.ObjectId.isValid(userId);
    } catch (_) {}
    const requesterUserDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: userId },
          ...(isRequesterObjectId ? [{ _id: new Types.ObjectId(userId) }] : []),
        ],
      })
      .exec();

    const allowedRequesterIds = new Set<string>([userId]);
    if (requesterUserDoc?.supabaseId)
      allowedRequesterIds.add(requesterUserDoc.supabaseId);
    if (requesterUserDoc?._id)
      allowedRequesterIds.add(requesterUserDoc._id.toString());

    const requesterMember = room.members.find(
      (m) =>
        allowedRequesterIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
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
        targetIds.has(m.userId) &&
        (m.isLeft === true || m.status === "REMOVED" || m.status === "LEFT"),
    );

    if (previousMemberIdx !== -1) {
      const prevMember = room.members[previousMemberIdx];
      // Nếu trạng thái trước đó là REMOVED (bị xóa khỏi phòng), chỉ cho phép owner hoặc vice thêm lại
      if (prevMember.status === "REMOVED") {
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
                  cm.role === "vice_leader") &&
                cm.status !== "REMOVED" &&
                cm.status !== "LEFT",
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

      room.members[previousMemberIdx].isLeft = false;
      room.members[previousMemberIdx].status = "ACTIVE";
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
        status: "ACTIVE",
        isLeft: false,
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
  async leaveRoom(roomId: string, userId: string, newOwnerId?: string) {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
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
      const newOwnerIndex = room.members.findIndex(
        (m) => m.userId === newOwnerId,
      );
      if (newOwnerIndex === -1) {
        throw new BadRequestException(
          "Người kế nhiệm được chọn không thuộc phòng này.",
        );
      }

      // Đảm bảo chủ phòng cũ (người rời) vẫn còn trong danh sách thành viên của các kênh riêng tư
      // trước khi hạ vai trò, để họ không mất quyền truy cập các kênh đó
      this.ensureOldOwnerInPrivateChannels(room, userId);

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
        .filter((m) => m.status !== "REMOVED" && m.status !== "LEFT") // không thông báo cho người bị xoá hoặc đã rời
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
          status: { $nin: ["REMOVED", "LEFT"] }, // Trạng thái không phải là đã bị xóa hoặc đã rời
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
          status: { $nin: ["REMOVED", "LEFT"] },
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
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );

    // Chủ phòng mới có full quyền mặc định
    if (roomMember && roomMember.role === "owner") {
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
        "Chỉ Trưởng nhóm/Giảng viên hoặc Phó nhóm/Ban cán sự của kênh mới có quyền thêm thành viên vào kênh riêng tư",
      );
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
    const existingRoomMember = room.members.find((m) =>
      targetIds.has(m.userId),
    );
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
        "Chỉ Trưởng nhóm/Giảng viên hoặc Phó nhóm/Ban cán sự của kênh mới có quyền xóa thành viên khỏi kênh riêng tư",
      );
    }

    if (targetUserId === room.ownerId) {
      throw new BadRequestException(
        "Không thể xóa Chủ phòng / Giảng viên khỏi kênh",
      );
    }

    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) throw new NotFoundException("Kênh không tồn tại");

    // Fetch user doc of requester to get full list of IDs
    const allowedUserIds = new Set<string>([userId]);
    const userDoc = await this.userModel
      .findOne({
        $or: [
          { supabaseId: userId },
          ...(Types.ObjectId.isValid(userId)
            ? [{ _id: new Types.ObjectId(userId) }]
            : []),
        ],
      })
      .exec();
    if (userDoc) {
      if (userDoc.supabaseId) allowedUserIds.add(userDoc.supabaseId);
      if (userDoc._id) allowedUserIds.add(userDoc._id.toString());
    }

    // Check if requester is a Room Leader/Owner
    const isRoomOwner = allowedUserIds.has(room.ownerId);
    const roomMember = room.members?.find(
      (m) =>
        allowedUserIds.has(m.userId) &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    const isRoomLeader =
      isRoomOwner || (roomMember && ["owner"].includes(roomMember.role));

    // Check if target is a Room Leader/Owner
    const targetRoomMember = room.members?.find(
      (m) => m.userId === targetUserId,
    );
    const isTargetRoomLeader =
      targetUserId === room.ownerId ||
      (targetRoomMember && ["owner"].includes(targetRoomMember.role));

    if (channel.members) {
      const targetMember = channel.members.find(
        (m) => m.userId === targetUserId,
      );
      if (targetMember) {
        // Enforce vice leader limitations
        if (!isRoomLeader) {
          if (isTargetRoomLeader) {
            throw new ForbiddenException(
              "Phó nhóm / Ban cán sự không thể xóa Trưởng nhóm / Giảng viên khỏi kênh",
            );
          }
          if (["vice", "assistant"].includes(targetMember.role)) {
            throw new ForbiddenException(
              "Phó nhóm / Ban cán sự không thể xóa Phó nhóm / Ban cán sự khác khỏi kênh",
            );
          }
        }

        targetMember.isLeft = true;
        targetMember.status = "REMOVED";
        targetMember.leftAt = new Date();
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

    return this.mapToRoomResponse(room);
  }

  /**
   * Đảm bảo chủ phòng cũ (oldOwnerId) được thêm vào danh sách thành viên của tất cả các kênh riêng tư
   * trong phòng (nếu họ chưa có), để tránh mất quyền truy cập sau khi chuyển giao quyền chủ phòng.
   * Phương thức này an toàn: chỉ thêm mới nếu chưa tồn tại, không thay đổi dữ liệu hiện có.
   */
  private ensureOldOwnerInPrivateChannels(
    room: RoomDocument,
    oldOwnerId: string,
  ) {
    if (!room.channels || !Array.isArray(room.channels)) return;

    let modified = false;
    for (const channel of room.channels) {
      if (!channel.isPrivate) continue; // Chỉ xử lý kênh riêng tư

      if (!channel.members) {
        channel.members = [];
      }

      const alreadyMember = channel.members.some(
        (cm) => cm.userId === oldOwnerId,
      );

      if (!alreadyMember) {
        // Thêm chủ phòng cũ như một thành viên bình thường
        channel.members.push({
          userId: oldOwnerId,
          role: "member",
          isLeft: false,
          status: "JOINED",
        });
        modified = true;
      }
    }

    if (modified) {
      room.markModified("channels");
    }
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
          (m: RoomMember) =>
            m.isLeft !== true && m.status !== "REMOVED" && m.status !== "LEFT",
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
