import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { SupabaseService } from "../../supabase/supabase.service";
import { AppException } from "../exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";

@Injectable()
export class SupabaseGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new AppException(ErrorCode.INVALID_TOKEN);
    }

    const {
      data: { user },
      error,
    } = await this.supabaseService.client.auth.getUser(token);

    if (error || !user) {
      // Bắt mọi lỗi: Token hết hạn, sai chữ ký, user đã bị khóa/xóa...
      throw new AppException(ErrorCode.INVALID_TOKEN);
    }

    // Kiểm tra trạng thái khóa (ban) từ Supabase Auth
    const isLocked =
      user.banned_until && new Date(user.banned_until) > new Date();
    if (isLocked) {
      throw new AppException(ErrorCode.ACCOUNT_LOCKED);
    }

    const mappedRole = user.app_metadata?.role || user.role || "user";

    // Gắn thông tin user vào request (Lấy role thực tế từ Supabase)
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
