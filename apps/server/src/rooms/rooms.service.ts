import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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
import { RoomsGateway } from "./rooms.gateway";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { normalizeRole } from "./helpers/room-role.helper";
import { mapToRoomResponse } from "./helpers/room.helper";
import { MeetingsService } from "../meetings/meetings.service";

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
  constructor(
    private eventEmitter: EventEmitter2,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => MeetingsService))
    private readonly meetingsService: MeetingsService,
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

    return mapToRoomResponse(room);
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

    // Map qua toàn bộ mảng, truyền userId để filter channels đã rời
    return rooms.map((room) => mapToRoomResponse(room, userId));
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

    // Đồng bộ nếu đang có cuộc họp đang diễn ra
    try {
      if (room.channels && Array.isArray(room.channels)) {
        const syncPromises = [];
        room.channels.forEach((channel) => {
          const channelIdStr = channel._id.toString();

          // Nâng quyền người nhận lên thành "owner"
          syncPromises.push(
            this.meetingsService.updateParticipantRole(
              roomId,
              channelIdStr,
              newOwnerId,
              "owner",
            ),
          );

          // Hạ quyền người chuyển (chủ cũ) xuống thành "member"
          syncPromises.push(
            this.meetingsService.updateParticipantRole(
              roomId,
              channelIdStr,
              operatorId,
              "member",
            ),
          );
        });

        await Promise.allSettled(syncPromises);
      }
    } catch (e) {
      console.error("Lỗi đồng bộ role chuyển quyền vào meeting:", e);
    }
    // ==========================================

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

    const updatedRoomPayload = mapToRoomResponse(room);
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
      room.members[previousMemberIndex].role = "member"; // BẮT BUỘC reset role về 'member'
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

    return mapToRoomResponse(room);
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
        m.userId === userId &&
        m.status !== "removed" &&
        m.status !== "remove" &&
        m.status !== "left",
    );
    if (memberIdx === -1) {
      throw new BadRequestException("Bạn không còn là thành viên của phòng này");
    }

    const member = room.members[memberIdx];

    if (member.role === "owner") {
      // Lọc ra những người CÒN ĐANG HOẠT ĐỘNG trong phòng (bỏ qua những người đã rời/bị xoá)
      const activeMembers = room.members.filter(
        (m) =>
          m.status !== "removed" &&
          m.status !== "remove" &&
          m.status !== "left",
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
        throw new BadRequestException("Vui lòng chỉ định Trưởng nhóm mới trước khi rời phòng");
      }

      // Kiểm tra người nhận quyền có tồn tại và đang active không
      const newOwnerIndex = room.members.findIndex(
        (m) =>
          m.userId === newOwnerId &&
          m.status !== "removed" &&
          m.status !== "remove" &&
          m.status !== "left",
      );
      if (newOwnerIndex === -1) {
        throw new BadRequestException("Người dùng nhận quyền không tồn tại hoặc không còn trong phòng");
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

  async getRoomByIdForUser(roomId: string, userId: string): Promise<RoomResponse> {
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

    // Sử dụng mapToRoomResponse với forUserId để tự động filter channels
    // (public channels ẩn nếu user trong leftMemberIds, private channels ẩn nếu không trong members[])
    return mapToRoomResponse(room, userId);
  }
}
