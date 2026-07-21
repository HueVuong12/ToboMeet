import {
  Controller,
  Get,
  Request,
  UseGuards,
  Delete,
  Param,
  Query,
  Put,
  Body,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseGuard)
  @Get("search")
  async searchUsers(@Query("q") query: string) {
    return this.usersService.searchUsers(query);
  }

  private getClientIp(req: any): string {
    const forwarded = req.headers["x-forwarded-for"] as string;
    let rawIp =
      (forwarded ? forwarded.split(",")[0].trim() : null) ||
      (req.headers["x-real-ip"] as string) ||
      req.ip ||
      req.socket?.remoteAddress ||
      "";

    // Chuẩn hóa IPv6 (::ffff:192.168.x.x -> 192.168.x.x)
    if (rawIp.startsWith("::ffff:")) {
      rawIp = rawIp.substring(7);
    }
    if (rawIp === "::1" || rawIp === "localhost") {
      rawIp = "127.0.0.1";
    }

    // Không lưu/sử dụng localhost khi chạy production
    const isProd = process.env.NODE_ENV === "production";
    return isProd && (rawIp === "127.0.0.1" || rawIp === "0.0.0.0") ? "" : rawIp;
  }

  @UseGuards(SupabaseGuard)
  @Get("me")
  async getMe(@Request() req) {
    const userDoc = await this.usersService.getOrCreateUser(req.user);
    
    // Tự động ghi nhận/cập nhật phiên hoạt động khi user tải trang / mở app
    const userId = req.user.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const userAgent = (req.headers["user-agent"] as string) || "";
    const clientIp = this.getClientIp(req);

    if (token) {
      // Gọi không đồng bộ (bất đồng bộ chạy nền) để không làm chậm request getMe chính
      this.usersService.registerOrUpdateSession(userId, token, userAgent, clientIp).catch(() => {});
    }

    return userDoc;
  }

  @UseGuards(SupabaseGuard)
  @Get("me/sessions")
  async getSessions(@Request() req) {
    const userId = req.user.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const userAgent = (req.headers["user-agent"] as string) || "";
    const clientIp = this.getClientIp(req);

    return this.usersService.getUserSessions(userId, token, userAgent, clientIp);
  }


  @UseGuards(SupabaseGuard)
  @Delete("me/sessions/others")
  async revokeOtherSessions(@Request() req) {
    const userId = req.user.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1] || "";
    const userAgent = (req.headers["user-agent"] as string) || "";
    return this.usersService.revokeOtherSessions(userId, token, userAgent);
  }

  @UseGuards(SupabaseGuard)
  @Delete("me/sessions/:id")
  async revokeSession(@Param("id") sessionId: string, @Request() req) {
    const userId = req.user.id;
    return this.usersService.revokeSession(userId, sessionId);
  }

  @UseGuards(SupabaseGuard)
  @Put("me/sessions/current/location")
  async updateLocation(
    @Request() req,
    @Body() body: { city: string; country: string }
  ) {
    const userId = req.user.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const userAgent = (req.headers["user-agent"] as string) || "";
    const safeBody = body || {};
    if (token) {
      await this.usersService.updateCurrentSessionLocation(
        userId,
        token,
        userAgent,
        safeBody.city || "",
        safeBody.country || ""
      );
    }
    return { success: true };
  }
}
