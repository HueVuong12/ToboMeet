import {
  Injectable,
  BadRequestException,
  Logger,
} from "@nestjs/common";
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

interface MappedSession {
  id: string;
  ip: string;
  deviceName: string;
  os: string;
  browser: string;
  isMobile: boolean;
  isDesktop: boolean;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionsResult {
  currentDevice: MappedSession | null;
  otherDevices: MappedSession[];
  recentlyLoggedOut: MappedSession[];
  totalLoggedOut: number;
}

@Injectable()
export class UsersService {
  private supabaseAdmin;
  private supabaseUrl: string;
  private supabaseServiceKey: string;
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.supabaseUrl = this.configService.get<string>("SUPABASE_URL");
    this.supabaseServiceKey = this.configService.get<string>(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    this.supabaseAdmin = createClient(
      this.supabaseUrl,
      this.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  async getOrCreateUser(tokenPayload): Promise<User> {
    const userId = tokenPayload.id || tokenPayload.sub;
    const email = tokenPayload.email
      ? tokenPayload.email.trim().toLowerCase()
      : "";
    const metadata = tokenPayload.user_metadata || {};

    let user = await this.userModel.findOne({
      $or: [
        { supabaseId: userId },
        { email: { $regex: new RegExp(`^${email}$`, "i") } },
      ],
    });

    if (user) {
      // Đồng bộ supabaseId nếu đăng nhập bằng OAuth mới
      let hasChanges = false;
      if (user.supabaseId !== userId) {
        user.supabaseId = userId;
        hasChanges = true;
      }
      if (
        user.displayName !== metadata.full_name ||
        user.avatarUrl !== metadata.avatar_url
      ) {
        user.displayName = metadata.full_name || user.displayName;
        user.avatarUrl = metadata.avatar_url || user.avatarUrl;
        hasChanges = true;
      }
      if (hasChanges) {
        await user.save();
        console.log(`Đã cập nhật/đồng bộ user: ${email}`);
      }
    } else {
      user = await this.userModel.create({
        supabaseId: userId,
        email: email,
        displayName: metadata.full_name,
        avatarUrl: metadata.avatar_url,
      });
      console.log(`Đã tạo mới user: ${email}`);
    }

    return user;
  }

  /**
   * Lấy danh sách phiên hoạt động của user.
   * Gọi trực tiếp Supabase Auth REST API vì SDK không có listUserSessions.
   * Fallback: nếu API không trả về sessions, tạo 1 session từ JWT + User-Agent hiện tại.
   */
  async getUserSessions(
    userId: string,
    currentToken: string,
    userAgent: string = "",
  ): Promise<SessionsResult> {
    // Bước 1: Giải mã JWT để lấy session_id và thời gian đăng nhập
    let currentSessionId = "";
    let tokenCreatedAt = new Date().toISOString();
    let tokenUpdatedAt = new Date().toISOString();

    try {
      const payloadBase64 = currentToken.split(".")[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, "base64").toString(),
      ) as Record<string, unknown>;
      currentSessionId =
        (payload.session_id as string) || (payload.sid as string) || "";
      if (payload.iat) {
        tokenCreatedAt = new Date(
          (payload.iat as number) * 1000,
        ).toISOString();
      }
      if (payload.exp) {
        // Dùng iat làm updatedAt (thời điểm token được cấp)
        tokenUpdatedAt = tokenCreatedAt;
      }
    } catch (e) {
      this.logger.warn("Không thể giải mã JWT token: " + String(e));
    }

    // Bước 2: Thử gọi Supabase Auth REST API để lấy tất cả sessions
    let sessions: SupabaseSession[] = [];
    try {
      const res = await fetch(
        `${this.supabaseUrl}/auth/v1/admin/users/${userId}/sessions`,
        {
          headers: {
            Authorization: `Bearer ${this.supabaseServiceKey}`,
            apikey: this.supabaseServiceKey,
          },
        },
      );
      if (res.ok) {
        const body = (await res.json()) as
          | { sessions?: SupabaseSession[] }
          | SupabaseSession[];
        if (Array.isArray(body)) {
          sessions = body;
        } else if (body && Array.isArray(body.sessions)) {
          sessions = body.sessions;
        }
      } else {
        this.logger.warn(
          `Supabase sessions API trả về ${res.status}. Dùng fallback.`,
        );
      }
    } catch (e) {
      this.logger.warn("Không thể gọi Supabase sessions API: " + String(e));
    }

    // Bước 3: Nếu có sessions từ API, map và đánh dấu isCurrent
    if (sessions.length > 0) {
      const mapped: MappedSession[] = sessions.map((s) => {
        const uaInfo = this.parseUserAgent(s.user_agent || userAgent);
        return {
          id: s.id,
          ip: s.ip || "",
          deviceName: uaInfo.deviceName,
          os: uaInfo.os,
          browser: uaInfo.browser,
          isMobile: uaInfo.isMobile,
          isDesktop: uaInfo.isDesktop,
          isCurrent:
            currentSessionId !== "" && s.id === currentSessionId,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        };
      });

      // Fallback: nếu không session nào isCurrent, lấy session mới nhất
      const hasCurrent = mapped.some((s) => s.isCurrent);
      if (!hasCurrent && mapped.length > 0) {
        const newestIdx = mapped.reduce(
          (bestIdx, s, idx) =>
            new Date(s.updatedAt) > new Date(mapped[bestIdx].updatedAt)
              ? idx
              : bestIdx,
          0,
        );
        // Cập nhật deviceName của current session với UA từ request thực tế
        const currentUaInfo = this.parseUserAgent(userAgent);
        mapped[newestIdx] = {
          ...mapped[newestIdx],
          isCurrent: true,
          deviceName: currentUaInfo.deviceName || mapped[newestIdx].deviceName,
          os: currentUaInfo.os !== "Không rõ" ? currentUaInfo.os : mapped[newestIdx].os,
          browser: currentUaInfo.browser !== "Trình duyệt Web" ? currentUaInfo.browser : mapped[newestIdx].browser,
        };
      }

      const currentDevice = mapped.find((s) => s.isCurrent) ?? null;
      const otherDevices = mapped.filter((s) => !s.isCurrent);
      return { currentDevice, otherDevices, recentlyLoggedOut: [], totalLoggedOut: 0 };
    }

    // Bước 4: Fallback hoàn toàn — tạo 1 session duy nhất từ JWT + User-Agent request
    const uaInfo = this.parseUserAgent(userAgent);
    const fallbackSession: MappedSession = {
      id: currentSessionId || "current",
      ip: "",
      deviceName: uaInfo.deviceName,
      os: uaInfo.os,
      browser: uaInfo.browser,
      isMobile: uaInfo.isMobile,
      isDesktop: uaInfo.isDesktop,
      isCurrent: true,
      createdAt: tokenCreatedAt,
      updatedAt: tokenUpdatedAt,
    };

    return {
      currentDevice: fallbackSession,
      otherDevices: [],
      recentlyLoggedOut: [],
      totalLoggedOut: 0,
    };
  }

  /**
   * Đăng xuất/hủy bỏ một phiên hoạt động qua Supabase Admin REST API
   */
  async revokeSession(userId: string, sessionId: string) {
    // Thử dùng SDK method destroySession (có thể không tồn tại)
    try {
      if (typeof this.supabaseAdmin.auth.admin.destroySession === "function") {
        const { error } = await this.supabaseAdmin.auth.admin.destroySession(sessionId);
        if (!error) {
          return { success: true, message: "Đã đăng xuất thiết bị thành công" };
        }
      }
    } catch {
      // SDK method không tồn tại, dùng REST API
    }

    // Fallback: Gọi REST API trực tiếp
    const res = await fetch(
      `${this.supabaseUrl}/auth/v1/admin/users/${userId}/sessions/${sessionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.supabaseServiceKey}`,
          apikey: this.supabaseServiceKey,
        },
      },
    );

    if (!res.ok && res.status !== 404) {
      throw new BadRequestException(
        `Không thể đăng xuất thiết bị này (HTTP ${res.status})`,
      );
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

  /**
   * Parse User-Agent để xác định OS, Browser, Device Type và tên thiết bị.
   * deviceName: "Chrome trên Windows", "Safari trên iPhone", v.v.
   */
  private parseUserAgent(ua: string) {
    if (!ua) {
      return {
        deviceName: "Trình duyệt Web",
        os: "Không rõ",
        browser: "Trình duyệt Web",
        isMobile: false,
        isDesktop: true,
      };
    }

    let os = "Không rõ";
    let browser = "Trình duyệt Web";
    let isMobile = false;
    let isDesktop = true;

    const uaLower = ua.toLowerCase();

    // ── Detect OS ─────────────────────────────────────────────────────────────
    if (uaLower.includes("iphone")) {
      os = "iPhone";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("ipad")) {
      os = "iPad";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("android")) {
      os = "Android";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("windows")) {
      os = "Windows";
    } else if (uaLower.includes("macintosh") || uaLower.includes("mac os x")) {
      os = "macOS";
    } else if (uaLower.includes("linux")) {
      // Phân biệt Ubuntu và Linux chung
      if (uaLower.includes("ubuntu")) {
        os = "Ubuntu";
      } else {
        os = "Linux";
      }
    } else if (uaLower.includes("cros")) {
      os = "Chrome OS";
    }

    // ── Detect Browser/App ────────────────────────────────────────────────────
    // Thứ tự quan trọng: Edge → Chrome → Safari → Firefox → Opera
    if (uaLower.includes("electron") || uaLower.includes("tobomeetdesktop")) {
      browser = "ToboMeet Desktop";
      isDesktop = true;
    } else if (uaLower.includes("tobomeetmobile")) {
      browser = "ToboMeet Mobile";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("edg/") || uaLower.includes("edge/")) {
      browser = "Edge";
    } else if (uaLower.includes("opr/") || uaLower.includes("opera")) {
      browser = "Opera";
    } else if (uaLower.includes("fxios") || uaLower.includes("firefox")) {
      browser = "Firefox";
    } else if (uaLower.includes("crios")) {
      // Chrome on iOS
      browser = "Chrome";
      isMobile = true;
      isDesktop = false;
    } else if (
      uaLower.includes("chrome") ||
      uaLower.includes("chromium")
    ) {
      browser = "Chrome";
    } else if (
      uaLower.includes("safari") &&
      !uaLower.includes("chrome") &&
      !uaLower.includes("android")
    ) {
      browser = "Safari";
    }

    // ── Tạo deviceName thân thiện ──────────────────────────────────────────────
    let deviceName: string;
    if (browser === "ToboMeet Desktop") {
      deviceName = "ToboMeet Desktop";
    } else if (browser === "ToboMeet Mobile") {
      deviceName = "ToboMeet Mobile";
    } else if (os !== "Không rõ") {
      deviceName = `${browser} trên ${os}`;
    } else {
      deviceName = browser;
    }

    return { deviceName, os, browser, isMobile, isDesktop };
  }
}
