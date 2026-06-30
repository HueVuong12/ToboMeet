import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class SupabaseGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Không tìm thấy Access Token");
    }

    // Decode JWT payload locally (không cần network call)
    const payload = this.decodeJwtPayload(token);

    if (!payload || !payload.sub) {
      throw new UnauthorizedException("Token không hợp lệ");
    }

    // Kiểm tra thời hạn token
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException("Token đã hết hạn");
    }

    // Gắn thông tin user vào request để Controller sử dụng
    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      user_metadata: payload.user_metadata || {},
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  private decodeJwtPayload(token: string): Record<string, any> | null {
    try {
      // JWT có dạng: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      // Decode phần payload (phần thứ 2) từ Base64URL
      const base64Payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = Buffer.from(base64Payload, "base64").toString("utf8");
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }
}
