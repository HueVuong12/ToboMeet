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

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  /**
   * Tạo phòng mới — auto-gen code, thêm owner vào members, tạo channel "General"
   */
  async createRoom(userId: string, dto: CreateRoomDto): Promise<Room> {
    const code = this.generateRoomCode();

    const room = await this.roomModel.create({
      name: dto.name,
      type: dto.type,
      code,
      ownerId: userId,
      members: [userId],
      channels: [{ name: "General" }],
    });

    return room;
  }

  /**
   * Lấy danh sách phòng mà user đã tham gia
   */
  async getMyRooms(userId: string): Promise<Room[]> {
    return this.roomModel
      .find({ members: userId })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /**
   * Tham gia phòng bằng mã code
   */
  async joinRoom(userId: string, roomCode: string): Promise<Room> {
    const room = await this.roomModel.findOne({ code: roomCode });

    if (!room) {
      throw new NotFoundException("Không tìm thấy phòng với mã này");
    }

    // Kiểm tra user đã là member chưa
    if (room.members.includes(userId)) {
      return room; // Đã là member, trả về room luôn
    }

    room.members.push(userId);
    await room.save();

    return room;
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
  async addChannel(userId: string, roomId: string, channelName: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);

    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    if (room.ownerId !== userId) {
      throw new ForbiddenException("Chỉ chủ phòng mới có quyền thêm kênh");
    }

    // Kiểm tra tên kênh đã trùng chưa (không phân biệt hoa thường)
    const exists = room.channels.some(
      (c) => c.name.toLowerCase() === channelName.trim().toLowerCase()
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
}
