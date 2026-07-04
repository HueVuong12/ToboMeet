import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { Model } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

interface SupabaseSession {
  id: string;
  ip?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class UsersService {
  private supabaseAdmin;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
    const supabaseServiceRole = this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async getOrCreateUser(tokenPayload): Promise<User> {
    const userId = tokenPayload.id || tokenPayload.sub;
    const email = tokenPayload.email;
    const metadata = tokenPayload.user_metadata || {};

    let user = await this.userModel.findOne({ supabaseId: userId });

    if (!user) {
      user = await this.userModel.create({
        supabaseId: userId,
        email: email,
        displayName: metadata.full_name,
        avatarUrl: metadata.avatar_url,
      });
      console.log(`Đã tạo mới user: ${email}`);
    }
    // Cập nhật lại tên/avatar nếu họ đổi từ Google/Facebook
    else if (
      user.displayName !== metadata.full_name ||
      user.avatarUrl !== metadata.avatar_url
    ) {
      user.displayName = metadata.full_name || user.displayName;
      user.avatarUrl = metadata.avatar_url || user.avatarUrl;
      await user.save();
      console.log(`Đã cập nhật user: ${email}`);
    }

    return user;
  }

  /**
   * Lấy danh sách phiên hoạt động của user từ Supabase
   */
  async getUserSessions(userId: string, currentToken: string) {
    // Giải mã JWT để lấy session_id hiện tại
    let currentSessionId = "";
    try {
      const payloadBase64 = currentToken.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString());
      currentSessionId = payload.session_id || payload.sid;
    } catch (e) {
      console.error("Lỗi giải mã token lấy session ID:", e);
    }

    const { data, error } = await this.supabaseAdmin.auth.admin.listUserSessions(userId);

    if (error || !data) {
      throw new BadRequestException("Không thể lấy danh sách thiết bị");
    }

    return data.sessions.map((session: SupabaseSession) => {
      const uaInfo = this.parseUserAgent(session.user_agent);
      return {
        id: session.id,
        ip: session.ip || "Không rõ",
        os: uaInfo.os,
        browser: uaInfo.browser,
        isMobile: uaInfo.isMobile,
        isDesktop: uaInfo.isDesktop,
        isCurrent: session.id === currentSessionId,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      };
    });
  }

  /**
   * Đăng xuất/hủy bỏ một phiên hoạt động
   */
  async revokeSession(userId: string, sessionId: string) {
    const { error } = await this.supabaseAdmin.auth.admin.destroySession(sessionId);

    if (error) {
      throw new BadRequestException("Không thể đăng xuất thiết bị này: " + error.message);
    }

    return { success: true, message: "Đã đăng xuất thiết bị thành công" };
  }

  async searchUsers(query: string): Promise<User[]> {
    if (!query || !query.trim()) return [];
    const searchRegex = new RegExp(query.trim(), "i");
    return this.userModel
      .find({
        $or: [{ email: searchRegex }, { displayName: searchRegex }],
      })
      .select("supabaseId email displayName avatarUrl")
      .limit(10)
      .exec();
  }

  private parseUserAgent(ua: string) {
    if (!ua) return { os: "Không rõ", browser: "Không rõ", isMobile: false, isDesktop: true };

    let os = "Không rõ";
    let browser = "Không rõ";
    let isMobile = false;
    let isDesktop = true;

    const uaLower = ua.toLowerCase();

    // Detect OS
    if (uaLower.includes("windows")) {
      os = "Windows";
    } else if (uaLower.includes("macintosh") || uaLower.includes("mac os")) {
      os = "macOS";
    } else if (uaLower.includes("iphone") || uaLower.includes("ipad")) {
      os = "iOS";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("android")) {
      os = "Android";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("linux")) {
      os = "Linux";
    }

    // Detect Browser/App
    if (uaLower.includes("electron") || uaLower.includes("tobomeetdesktop")) {
      browser = "ToboMeet Desktop";
      isDesktop = true;
    } else if (uaLower.includes("tobomeetmobile")) {
      browser = "ToboMeet Mobile";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("chrome") || uaLower.includes("crios")) {
      browser = "Chrome";
    } else if (uaLower.includes("safari") && !uaLower.includes("chrome") && !uaLower.includes("android")) {
      browser = "Safari";
    } else if (uaLower.includes("firefox") || uaLower.includes("fxios")) {
      browser = "Firefox";
    } else if (uaLower.includes("edge") || uaLower.includes("edg")) {
      browser = "Edge";
    } else {
      browser = "Trình duyệt Web";
    }

    return { os, browser, isMobile, isDesktop };
  }
}
