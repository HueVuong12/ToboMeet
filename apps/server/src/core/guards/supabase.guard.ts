import { Injectable, CanActivate, ExecutionContext, HttpException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { Request } from "express";
import { SupabaseService } from "../../supabase/supabase.service";
import { AppException } from "../exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";
import { User, UserDocument } from "../../users/schemas/user.schema";

@Injectable()
export class SupabaseGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Bỏ qua xác thực hoàn toàn cho endpoint kiểm tra trạng thái khóa (check-lock)
    if (request.path && (request.path.includes("/admin/check-lock") || request.path.includes("/check-lock"))) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new AppException(ErrorCode.INVALID_TOKEN);
    }

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) {
      throw new AppException(ErrorCode.INVALID_TOKEN);
    }

    // Tra cứu trạng thái người dùng trong MongoDB
    const u = await this.userModel.findOne({ supabaseId: user.id }).exec();
    if (u) {
      let currentStatus = u.status || "ACTIVE";

      // Cơ chế tự động mở khóa (Self-healing) nếu thời gian tạm khóa đã hết hạn
      if (currentStatus === "BLOCKED" && u.lockType === "TEMPORARY" && u.lockedUntil && new Date() >= u.lockedUntil) {
        try {
          u.status = "ACTIVE";
          u.lockType = null;
          u.lockSource = null;
          u.lockedAt = null;
          u.lockedUntil = null;
          u.lockReason = null;
          u.lockedBy = null;
          u.recommendedDuration = null;
          u.actualDuration = null;
          u.violationType = null;

          if (u.lockHistory && u.lockHistory.length > 0) {
            const lastLock = u.lockHistory[u.lockHistory.length - 1];
            if (!lastLock.unlockedAt) {
              lastLock.unlockedAt = new Date();
              lastLock.unlockedBy = "System (Self-healing)";
            }
          }

          await u.save();

          // Gỡ ban trên Supabase Auth
          await this.supabaseService.admin.auth.admin.updateUserById(user.id, { ban_duration: "none" });
          currentStatus = "ACTIVE";
        } catch (e) {
          console.error("Lỗi tự động mở khóa trong SupabaseGuard:", e);
        }
      }

      if (currentStatus === "BLOCKED") {
        const timeZone = "Asia/Ho_Chi_Minh";
        const formattedUntil = u.lockedUntil
          ? u.lockedUntil.toLocaleString("vi-VN", { timeZone })
          : "Vô thời hạn";

        throw new HttpException(
          {
            code: 4031, // ACCOUNT_LOCKED
            message: u.lockType === "INDEFINITE"
              ? "Tài khoản của bạn đã bị khóa vô thời hạn cho đến khi quản trị viên mở khóa."
              : `Tài khoản của bạn đang bị khóa cho đến ${formattedUntil}. Lý do: ${u.lockReason}`,
            lockedUntil: u.lockedUntil,
            lockReason: u.lockReason,
            lockType: u.lockType,
            violationType: u.violationType,
          },
          403
        );
      }
    }

    const mappedRole = user.app_metadata?.role || user.role || "user";

    request.user = {
      id: user.id,
      email: user.email,
      role: mappedRole,
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {},
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
