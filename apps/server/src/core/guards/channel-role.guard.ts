// src/modules/core/guards/channel-role.guard.ts
import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Room, RoomDocument } from "../../rooms/schemas/room.schema";
import { User, UserDocument } from "../../users/schemas/user.schema";
import { normalizeRole } from "../../rooms/helpers/room-role.helper";
import { AppException } from "../exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";

@Injectable()
export class ChannelRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const roomId = request.params.id || request.params.roomId;
    const channelId = request.params.channelId;

    if (!userId || !roomId || !channelId) return false;

    // Lấy thông tin phòng
    const room = await this.roomModel.findById(roomId);
    if (!room) return false;

    // Lấy thông tin kênh
    const channel = room.channels.find((c) => c._id?.toString() === channelId);
    if (!channel) return false;

    // Tìm thông tin User để lấy cả supabaseId và MongoDB _id
    const userDoc = await this.userModel.findOne({ supabaseId: userId });
    const allowedUserIds = [userId?.toString()];
    if (userDoc) {
      allowedUserIds.push(userDoc._id.toString());
    }

    // Định danh cấp độ phòng
    const isRoomOwner = allowedUserIds.includes(room.ownerId?.toString());
    const roomMember = room.members.find((m) => m.userId && allowedUserIds.includes(m.userId.toString()));
    const normalizedRoomRole = roomMember ? normalizeRole(roomMember.role) : "guest";
    const isRoomLeader = isRoomOwner || normalizedRoomRole === "owner";
    const isRoomAdmin = normalizedRoomRole === "admin";

    // Lấy thông tin member trong kênh cụ thể (Nơi chỉ chứa Admin với kênh public)
    const channelMember = channel.members?.find((m) => m.userId && allowedUserIds.includes(m.userId.toString()));
    const normalizedChannelRole = channelMember ? normalizeRole(channelMember.role) : "guest";

    if (channel.isPrivate) {
      // Nếu là kênh private: Bắt buộc phải là Chủ phòng, Phó phòng hoặc có tên trong channel.members
      if (!isRoomLeader && !isRoomAdmin && !channelMember) {
        throw new AppException(ErrorCode.INVALID_PERMISSION);
      }
    }

    let userChannelRole = "guest"; // Mặc định là guest (không có quyền gì)

    if (isRoomLeader) {
      // Chủ phòng luôn có toàn quyền
      userChannelRole = "owner";
    } else if (isRoomAdmin) {
      // Phó phòng (Room Admin) luôn giữ vai trò admin ở mọi kênh
      userChannelRole = "admin";
    } else if (channelMember) {
      // Có dữ liệu ghi đè cấp kênh (Admin kênh public HOẶC thành viên kênh private)
      userChannelRole = normalizedChannelRole;
    } else if (!channel.isPrivate && roomMember) {
      // Tự động kế thừa role từ cấp phòng (room member)
      userChannelRole = normalizedRoomRole;
    }



    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(userChannelRole)) {
        throw new AppException(ErrorCode.INVALID_PERMISSION);
      }
    }

    return true;
  }
}
