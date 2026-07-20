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
        status: { $ne: "disbanded" },
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

    const data: RoomMemberResponse[] = activeMembers.map((member) => {
      const userInfo = users.find((u) => u.supabaseId === member.userId);

      return {
        userId: member.userId,
        role: member.role as "owner" | "member", // Đảm bảo đúng enum
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

    // Không cho phép xóa chủ phòng
    const member = room.members.find((m) => m.userId === targetUserId);
    if (member?.role === "owner") {
      throw new BadRequestException("Không thể xóa chủ phòng");
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
      room.members.push({ userId, role: "member", joinedAt: new Date(), status: "ACTIVE", isLeft: false });
    }
    await room.save();

    // Lấy thông tin user từ Database
    const userInfo = await this.userModel.findOne({ supabaseId: userId });

    // Format dữ liệu chuẩn theo interface RoomMemberResponse
    const newMemberPayload: RoomMemberResponse = {
      userId: userId,
      role: "member",
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
      room.members.push({
        userId: targetUser.supabaseId,
        role: "member",
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
