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
import { RoomMemberResponse, RoomResponse } from "@tobomeet/shared/types";
import { RoomMember } from "./schemas/room-member.schema";

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

    return this.mapToRoomResponse(room);
  }

  /**
   * Lấy danh sách phòng mà user đã tham gia
   */
  async getMyRooms(userId: string): Promise<RoomResponse[]> {
    const rooms = await this.roomModel
      .find({ "members.userId": userId })
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

    const memberUserIds = room.members.map((member) => member.userId);
    const users = await this.userModel
      .find({ supabaseId: { $in: memberUserIds } })
      .exec();

    const data: RoomMemberResponse[] = room.members.map((member) => {
      const userInfo = users.find((u) => u.supabaseId === member.userId);

      return {
        userId: member.userId,
        role: member.role as "owner" | "member", // Đảm bảo đúng enum
        joinedAt: member.joinedAt.toISOString(), // Ép ngày thành string
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
  async removeMember(roomId: string, targetUserId: string) {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException("Phòng không tồn tại");

    // Không cho phép xóa chủ phòng
    const member = room.members.find((m) => m.userId === targetUserId);
    if (member?.role === "owner") {
      throw new BadRequestException("Không thể xóa chủ phòng");
    }

    // Xóa khỏi mảng và lưu
    room.members = room.members.filter((m) => m.userId !== targetUserId);
    await room.save();
    return { message: "Đã xóa thành viên" };
  }

  /**
   * Tham gia phòng bằng mã code
   */
  async joinRoom(userId: string, roomCode: string) {
    const room = await this.roomModel.findOne({ code: roomCode });
    if (!room) throw new NotFoundException("Không tìm thấy phòng với mã này");

    // Ràng buộc 1: Giới hạn 100 thành viên
    if (room.members.length >= 100) {
      throw new BadRequestException("Phòng đã đạt số lượng tối đa (100 người)");
    }

    // Ràng buộc 2: Kiểm tra trùng lặp
    const isAlreadyMember = room.members.some(
      (member) => member.userId === userId,
    );
    if (isAlreadyMember) {
      return { message: "Bạn đã ở trong phòng này", room };
    }

    // Thêm member mới
    room.members.push({ userId, role: "member", joinedAt: new Date() });
    await room.save();
  }

  /**
   * Lấy chi tiết 1 phòng theo ID
   */
  async getRoomById(roomId: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);

    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
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
    const room = await this.roomModel.findById(roomId);

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
      // Ánh xạ members cơ bản
      members: plainRoom.members?.map((m: RoomMember) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: plainRoom.createdAt.toISOString(),
      updatedAt: plainRoom.updatedAt.toISOString(),
    };
  }
}
