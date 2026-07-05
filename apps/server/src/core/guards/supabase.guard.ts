import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Thiếu cấu hình SUPABASE_URL hoặc SUPABASE_ANON_KEY");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Không tìm thấy Access Token");
    }

    // Gọi API của Supabase để verify token và lấy cục dữ liệu user
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      // Bắt mọi lỗi: Token hết hạn, sai chữ ký, user đã bị khóa/xóa...
      throw new UnauthorizedException(
        `Xác thực thất bại: ${error?.message || "Token không hợp lệ"}`,
      );
    }

    // Kiểm tra trạng thái khóa (ban) từ Supabase Auth
    const isLocked = user.banned_until && new Date(user.banned_until) > new Date();
    if (isLocked) {
      throw new ForbiddenException(
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên."
      );
    }

    const mappedRole = user.app_metadata?.role || user.role || "user";

    // Log chẩn đoán phân quyền
    console.log(`[Auth Diagnostic] Request URL: ${request.url} | Email: ${user.email} | Mapped Role: ${mappedRole}`);

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
