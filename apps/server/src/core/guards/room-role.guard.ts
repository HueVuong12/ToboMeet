import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ROLES_KEY, MemberRole } from "../decorators/roles.decorator";
import { Room, RoomDocument } from "../../rooms/schemas/room.schema";
import { User, UserDocument } from "../../users/schemas/user.schema";
import { normalizeRole } from "../../rooms/helpers/room-role.helper";
import { AppException } from "../exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";

@Injectable()
export class RoomRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Lấy danh sách role được phép từ metadata
    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu không gắn decorator @Roles, mặc định không cho truy cập (bảo mật)
    if (!requiredRoles) return false;

    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;
    const roomId = request.params.id;

    const room = await this.roomModel.findById(roomId);
    if (!room) return false;

    // Tìm thông tin User để lấy cả supabaseId và MongoDB _id
    const userDoc = await this.userModel.findOne({ supabaseId: userId });
    const allowedUserIds = [userId?.toString()];
    if (userDoc) {
      allowedUserIds.push(userDoc._id.toString());
    }

    const member = room.members.find((m) => m.userId && allowedUserIds.includes(m.userId.toString()));
    if (!member) {
      throw new AppException(ErrorCode.INVALID_PERMISSION);
    }

    const normalizedRole = normalizeRole(member.role);

    // Kiểm tra xem role của user có nằm trong danh sách requiredRoles không
    if (!requiredRoles.includes(normalizedRole as MemberRole)) {
      throw new AppException(ErrorCode.INVALID_PERMISSION);
    }

    return true;
  }
}

