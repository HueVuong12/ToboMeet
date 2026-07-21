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
  /** Địa chỉ IP của phiên đăng nhập */
  ip: string;
  /** Tên thiết bị thân thiện, ví dụ "Chrome trên Windows" */
  deviceName: string;
  os: string;
  browser: string;
  loginMethod: string;
  isMobile: boolean;
  isDesktop: boolean;
  isCurrent: boolean;
  /** Thành phố (từ geolocation) */
  city: string;
  /** Quốc gia (từ geolocation) */
  country: string;
  createdAt: string;
  updatedAt: string;
}


export interface SessionsResult {
  currentDevice: MappedSession | null;
  otherDevices: MappedSession[];
  recentlyLoggedOut: MappedSession[];
  totalLoggedOut: number;
}

/** Kết quả từ ip-api.com */
interface IpApiResponse {
  status: "success" | "fail";
  city?: string;
  country?: string;
  countryCode?: string;
  query?: string; // IP công cộng trả về từ API
  message?: string;
}

@Injectable()
export class UsersService {
  private supabaseAdmin;
  private supabaseUrl: string;
  private supabaseServiceKey: string;
  private readonly logger = new Logger(UsersService.name);

  /** Cache geolocation để tránh gọi API quá nhiều lần cho cùng 1 IP */
  private readonly geoCache = new Map<string, { city: string; country: string; publicIp: string }>();

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
   * Tra cứu vị trí (city, country, publicIp) từ địa chỉ IP dùng ip-api.com.
   * Nếu IP là localhost/private (dev environment), tự động gọi API không truyền IP để lấy vị trí & IP WAN thực tế.
   */
  private async getGeolocation(
    ip: string,
  ): Promise<{ city: string; country: string; publicIp: string }> {
    const unknown = { city: "Không xác định", country: "", publicIp: ip };

    const privatePatterns = [
      /^127\./,
      /^::1$/,
      /^localhost$/i,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^::ffff:127\./,
    ];

    const isPrivate = !ip || privatePatterns.some((p) => p.test(ip));
    const targetUrl = isPrivate
      ? `http://ip-api.com/json/?fields=status,city,country,countryCode,query`
      : `http://ip-api.com/json/${ip}?fields=status,city,country,countryCode,query`;

    const cacheKey = isPrivate ? "CURRENT_DEV_LOCATION" : ip;

    if (this.geoCache.has(cacheKey)) {
      return this.geoCache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return unknown;

      const data = (await res.json()) as IpApiResponse;

      if (data.status !== "success" || !data.country) return unknown;

      const result = {
        city: data.city || "",
        country: data.country,
        publicIp: data.query || ip,
      };

      if (this.geoCache.size >= 200) {
        const firstKey = this.geoCache.keys().next().value;
        if (firstKey) this.geoCache.delete(firstKey);
      }
      this.geoCache.set(cacheKey, result);
      return result;
    } catch (e) {
      this.logger.warn(`Geolocation lookup thất bại cho IP ${ip}: ${String(e)}`);
      return unknown;
    }
  }



  /**
   * Lấy danh sách phiên hoạt động của user.
   * Gọi trực tiếp Supabase Auth REST API vì SDK không có listUserSessions.
   * Fallback: nếu API không trả về sessions, tạo 1 session từ JWT + User-Agent + IP hiện tại.
   */
  async getUserSessions(
    userId: string,
    currentToken: string,
    userAgent: string = "",
    clientIp: string = "",
  ): Promise<SessionsResult> {
    // Bước 1: Giải mã JWT lấy session_id, thời gian và phương thức đăng nhập
    let currentSessionId = "";
    let tokenCreatedAt = new Date().toISOString();
    let tokenUpdatedAt = new Date().toISOString();
    let loginMethod = "password";

    try {
      const payloadBase64 = currentToken.split(".")[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, "base64").toString(),
      ) as Record<string, any>;
      currentSessionId =
        (payload.session_id as string) || (payload.sid as string) || "";
      if (payload.iat) {
        tokenCreatedAt = new Date(
          (payload.iat as number) * 1000,
        ).toISOString();
        tokenUpdatedAt = tokenCreatedAt;
      }

      // Trích xuất loginMethod từ app_metadata.provider hoặc amr
      const provider = payload.app_metadata?.provider;
      const amr = payload.amr;
      if (provider === "google" || (Array.isArray(amr) && amr.some((a: any) => a.method === "oauth"))) {
        loginMethod = "google";
      } else if (provider === "email" || (Array.isArray(amr) && amr.some((a: any) => a.method === "password"))) {
        loginMethod = "password";
      } else if (provider) {
        loginMethod = provider;
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

    // Bước 3: Nếu có sessions từ API, map + geolocation song song
    if (sessions.length > 0) {
      const mappedRaw = sessions.map((s) => {
        const uaInfo = this.parseUserAgent(s.user_agent || userAgent);
        const isCurrent =
          currentSessionId !== "" && s.id === currentSessionId;
        return {
          id: s.id,
          ip: s.ip || (isCurrent ? clientIp : ""),
          uaInfo,
          isCurrent,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        };
      });

      // Fallback isCurrent: lấy session mới nhất
      const hasCurrent = mappedRaw.some((s) => s.isCurrent);
      if (!hasCurrent && mappedRaw.length > 0) {
        const newestIdx = mappedRaw.reduce(
          (bestIdx, s, idx) =>
            new Date(s.updatedAt) > new Date(mappedRaw[bestIdx].updatedAt)
              ? idx
              : bestIdx,
          0,
        );
        const currentUaInfo = this.parseUserAgent(userAgent);
        mappedRaw[newestIdx] = {
          ...mappedRaw[newestIdx],
          isCurrent: true,
          ip: mappedRaw[newestIdx].ip || clientIp,
          uaInfo: {
            ...mappedRaw[newestIdx].uaInfo,
            deviceName:
              currentUaInfo.deviceName || mappedRaw[newestIdx].uaInfo.deviceName,
            browser:
              currentUaInfo.browser !== "Trình duyệt Web"
                ? currentUaInfo.browser
                : mappedRaw[newestIdx].uaInfo.browser,
            os:
              currentUaInfo.os !== "Không rõ"
                ? currentUaInfo.os
                : mappedRaw[newestIdx].uaInfo.os,
          },
        };
      }

      // Gọi geolocation song song cho tất cả sessions có IP
      const geoResults = await Promise.all(
        mappedRaw.map((s) => this.getGeolocation(s.ip)),
      );

      const mapped: MappedSession[] = mappedRaw.map((s, i) => {
        const geo = geoResults[i];
        return {
          id: s.id,
          ip: s.ip || "Không rõ",
          deviceName: s.uaInfo.deviceName,
          os: s.uaInfo.os,
          browser: s.uaInfo.browser,
          loginMethod: s.isCurrent ? loginMethod : "password",
          isMobile: s.uaInfo.isMobile,
          isDesktop: s.uaInfo.isDesktop,
          isCurrent: s.isCurrent,
          city: geo.city,
          country: geo.country,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });

      const currentDevice = mapped.find((s) => s.isCurrent) ?? null;
      const otherDevices = mapped.filter((s) => !s.isCurrent);
      return { currentDevice, otherDevices, recentlyLoggedOut: [], totalLoggedOut: 0 };
    }

    // Bước 4: Fallback hoàn toàn — 1 session từ JWT + User-Agent + IP request
    const uaInfo = this.parseUserAgent(userAgent);
    const geo = await this.getGeolocation(clientIp);

    const fallbackSession: MappedSession = {
      id: currentSessionId || "current",
      ip: clientIp || "Không rõ",
      deviceName: uaInfo.deviceName,
      os: uaInfo.os,
      browser: uaInfo.browser,
      loginMethod: loginMethod,
      isMobile: uaInfo.isMobile,
      isDesktop: uaInfo.isDesktop,
      isCurrent: true,
      city: geo.city,
      country: geo.country,
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
   * Parse User-Agent → { deviceName, os, browser, isMobile, isDesktop }
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
    } else if (uaLower.includes("cros")) {
      os = "Chrome OS";
    } else if (uaLower.includes("ubuntu")) {
      os = "Ubuntu";
    } else if (uaLower.includes("linux")) {
      os = "Linux";
    }

    // ── Detect Browser (thứ tự quan trọng: Edge trước Chrome) ─────────────────
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
      browser = "Chrome";
      isMobile = true;
      isDesktop = false;
    } else if (uaLower.includes("chrome") || uaLower.includes("chromium")) {
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
