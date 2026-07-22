import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { DeviceSession, DeviceSessionDocument } from "./schemas/device-session.schema";
import { Model } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { AppGateway } from "../core/gateways/app.gateway";
import { createHash } from "crypto";

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
  /** Nhà mạng ISP (từ geolocation) */
  isp?: string;
  /** IP thật thu nhận được (hoặc null nếu không có hoặc private IP ở prod) */
  ipAddress?: string | null;
  isGps?: boolean;
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
  regionName?: string;
  country?: string;
  countryCode?: string;
  isp?: string;
  org?: string;
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
  private readonly geoCache = new Map<string, { city: string; country: string; isp: string; publicIp: string }>();

  /** Kiểm tra IP private/loopback — dùng chung cho getGeolocation và display IP */
  private readonly privateIpPatterns = [
    /^127\./,
    /^::1$/,
    /^localhost$/i,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^::ffff:127\./,
    /^::ffff:10\./,
    /^::ffff:192\.168\./,
    /^fd[0-9a-f]{2}:/i,
  ];

  private isPrivateIp(ip: string): boolean {
    if (!ip) return true;
    return this.privateIpPatterns.some((p) => p.test(ip));
  }

  private getRealIpAddress(ip: string): string | null {
    if (!ip || ip === "UNKNOWN") return null;
    let clean = ip.trim();
    if (clean.startsWith("::ffff:")) {
      clean = clean.substring(7);
    }
    if (clean === "::1" || clean === "localhost") {
      clean = "127.0.0.1";
    }
    if (this.isPrivateIp(clean)) {
      // Cho phép 127.0.0.1 ở dev, nhưng chặn ở production
      if (process.env.NODE_ENV === "production") {
        return null;
      }
      return clean;
    }
    return clean;
  }

  public extractSessionId(token: string, userAgent: string = ""): string {
    if (!token) return "";
    try {
      const payloadBase64 = token.split(".")[1];
      if (!payloadBase64) return "";
      const payload = JSON.parse(
        Buffer.from(payloadBase64, "base64").toString(),
      ) as Record<string, any>;

      const sid =
        (payload.session_id as string) ||
        (payload.sid as string) ||
        (payload.jti as string) ||
        "";

      if (sid) return sid;

      const sub = payload.sub as string;
      const cleanUa = (userAgent || "").trim().toLowerCase();
      if (sub && cleanUa) {
        return createHash("sha256").update(`${sub}-${cleanUa}`).digest("hex");
      }
      return sub || "";
    } catch {
      return "";
    }
  }


  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(DeviceSession.name) private sessionModel: Model<DeviceSessionDocument>,
    private configService: ConfigService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
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
   * Tra cứu vị trí (city, country, isp, publicIp) từ địa chỉ IP dùng ip-api.com.
   * Khi ip là địa chỉ private/localhost (dev mode), gọi ip-api.com/json không truyền IP để lấy WAN public IP.
   */
  private async getGeolocation(
    ip: string,
  ): Promise<{ city: string; country: string; isp: string; publicIp: string }> {
    const unknown = { city: "", country: "Không xác định", isp: "", publicIp: ip };

    if (!ip || ip === "UNKNOWN") return unknown;

    const isPrivate = this.isPrivateIp(ip);
    const cacheKey = isPrivate ? "LOCAL_WAN" : ip;

    if (this.geoCache.has(cacheKey)) {
      return this.geoCache.get(cacheKey)!;
    }

    // Khi IP là private/localhost (dev mode), tra cứu không truyền IP để lấy WAN public IP hiện tại
    const targetUrl = isPrivate
      ? `http://ip-api.com/json/?fields=status,message,city,regionName,country,countryCode,isp,org,query`
      : `http://ip-api.com/json/${ip}?fields=status,message,city,regionName,country,countryCode,isp,org,query`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) return unknown;

      const data = (await res.json()) as IpApiResponse;

      if (data.status !== "success") {
        this.logger.warn(`ip-api.com trả về status "${data.status}" (${data.message ?? ""}) cho IP ${ip}`);
        return unknown;
      }
      if (!data.country) return unknown;

      // Ưu tiên regionName (Tỉnh/Thành phố như Đà Nẵng, Kon Tum, Hà Nội...) 
      // trước khi fallback sang city (Huyện/Thị xã nhỏ như Đắk Glei)
      const rawCity = (data.regionName || data.city || "").trim();
      const safeCity = rawCity.length > 0 ? rawCity : "";
      const rawIsp = (data.isp || data.org || "").trim();

      const result = {
        city: safeCity,
        country: data.country.trim(),
        isp: rawIsp,
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



  async registerOrUpdateSession(
    userId: string,
    currentToken: string,
    userAgent: string,
    clientIp: string,
  ): Promise<void> {
    if (!currentToken || !userId) return;
    try {
      const sessionId = this.extractSessionId(currentToken, userAgent);
      if (!sessionId) return;

      // 1. Kiểm tra xem phiên này đã bị thu hồi từ xa hay chưa
      const existing = await this.sessionModel.findOne({ sessionId, userId }).lean();
      if (existing?.isRevoked) {
        throw new UnauthorizedException("Phiên đăng nhập đã bị thu hồi từ xa.");
      }

      const uaInfo = this.parseUserAgent(userAgent);
      const cleanIp = this.getRealIpAddress(clientIp) || "127.0.0.1";
      const geo = await this.getGeolocation(cleanIp);

      let payload: Record<string, any> = {};
      try {
        const payloadBase64 = currentToken.split(".")[1];
        if (payloadBase64) {
          payload = JSON.parse(
            Buffer.from(payloadBase64, "base64").toString(),
          ) as Record<string, any>;
        }
      } catch {
        // ignore payload parsing failure
      }

      const amr: Array<{ method: string }> = Array.isArray(payload.amr) ? payload.amr : [];
      const provider: string = (payload.app_metadata?.provider || "").toLowerCase();
      let loginMethod = "password";

      if (provider === "google" || amr.some((a) => a.method === "oauth")) {
        loginMethod = "google";
      } else {
        loginMethod = "password";
      }

      const ipAddress = this.getRealIpAddress(clientIp);

      const sessionData = {
        sessionId,
        userId,
        ip: cleanIp,
        ipAddress,
        userAgent,
        deviceName: uaInfo.deviceName,
        os: uaInfo.os,
        browser: uaInfo.browser,
        city: geo.city || "",
        country: geo.country || "Không xác định",
        isp: geo.isp || "",
        loginMethod,
        isMobile: uaInfo.isMobile,
        isDesktop: uaInfo.isDesktop,
        updatedAt: new Date(),
      };

      await this.sessionModel.findOneAndUpdate(
        { sessionId },
        { $set: sessionData, $setOnInsert: { createdAt: new Date(), isGps: false } },
        { upsert: true, new: true },
      );
    } catch (e) {
      this.logger.error("Lỗi khi ghi nhận/cập nhật DeviceSession: " + String(e));
    }
  }

  /**
   * Lấy danh sách phiên hoạt động của user từ MongoDB.
   */
  async getUserSessions(
    userId: string,
    currentToken: string,
    userAgent: string = "",
    clientIp: string = "",
  ): Promise<SessionsResult> {
    const currentSessionId = this.extractSessionId(currentToken, userAgent);

    // Tự động đồng bộ/cập nhật session hiện tại vào MongoDB
    if (currentSessionId) {
      await this.registerOrUpdateSession(userId, currentToken, userAgent, clientIp);
    }

    try {
      const dbSessions = await this.sessionModel
        .find({ userId, isRevoked: { $ne: true } })
        .sort({ updatedAt: -1 })
        .lean()
        .exec();

      const mapped: MappedSession[] = dbSessions.map((s) => {
        const isCurrent = s.sessionId === currentSessionId;
        return {
          id: s.sessionId,
          ip: s.ip === "127.0.0.1" && process.env.NODE_ENV === "production" ? "Không rõ" : s.ip || "Không rõ",
          ipAddress: s.ipAddress || null,
          deviceName: s.deviceName,
          os: s.os,
          browser: s.browser,
          loginMethod: s.loginMethod || "password",
          isMobile: !!s.isMobile,
          isDesktop: !!s.isDesktop,
          isCurrent,
          isGps: !!s.isGps,
          city: s.city || "",
          country: s.country || "Không xác định",
          isp: s.isp || "",
          createdAt: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: s.updatedAt ? s.updatedAt.toISOString() : new Date().toISOString(),
        };
      });

      const currentDevice = mapped.find((s) => s.isCurrent) ?? null;
      const otherDevices = mapped.filter((s) => !s.isCurrent);
      return { currentDevice, otherDevices, recentlyLoggedOut: [], totalLoggedOut: 0 };
    } catch (err) {
      this.logger.error("Lỗi khi đọc sessions từ MongoDB: " + String(err));
      return { currentDevice: null, otherDevices: [], recentlyLoggedOut: [], totalLoggedOut: 0 };
    }
  }

  /**
   * Đăng xuất/hủy bỏ một phiên hoạt động qua Supabase Admin REST API và xóa khỏi MongoDB
   */
  async revokeSession(userId: string, sessionId: string) {
    // 1. Đánh dấu session bị thu hồi trong MongoDB
    try {
      await this.sessionModel.updateOne(
        { sessionId, userId },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      ).exec();
    } catch (err) {
      this.logger.error("Lỗi khi đánh dấu thu hồi DeviceSession khỏi MongoDB: " + String(err));
    }

    // 2. Bắn tin nhắn Realtime WebSocket đăng xuất tức thì cho client
    try {
      if (this.appGateway?.server) {
        this.appGateway.server.to(`user_${userId}`).emit("session_revoked", { sessionId });
      }
    } catch (err) {
      this.logger.error("Lỗi khi bắn WebSocket session_revoked: " + String(err));
    }

    // 2. Thu hồi/đăng xuất phiên trên Supabase
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
      this.logger.warn(`Không thể xóa session trên Supabase (HTTP ${res.status}), nhưng đã xóa khỏi DB local.`);
    }

    return { success: true, message: "Đã đăng xuất thiết bị thành công" };
  }

  /**
   * Đăng xuất/hủy bỏ tất cả các phiên đăng nhập khác của user ngoại trừ phiên hiện tại
   */
  async revokeOtherSessions(userId: string, currentToken: string, userAgent: string = "") {
    if (!currentToken || !userId) {
      throw new BadRequestException("Token hoặc User ID không hợp lệ.");
    }

    const currentSessionId = this.extractSessionId(currentToken, userAgent);

    if (!currentSessionId) {
      throw new BadRequestException("Không xác định được phiên làm việc hiện tại.");
    }

    // 1. Tìm tất cả các session ID khác đang hoạt động
    const otherSessions = await this.sessionModel
      .find({
        userId,
        sessionId: { $ne: currentSessionId },
        isRevoked: { $ne: true },
      })
      .select("sessionId")
      .lean();

    const revokedSessionIds = otherSessions.map((s) => s.sessionId);

    // 2. Cập nhật isRevoked = true trong MongoDB
    await this.sessionModel.updateMany(
      { userId, sessionId: { $ne: currentSessionId } },
      { $set: { isRevoked: true, revokedAt: new Date() } },
    );

    // 3. Phát WebSocket event session_revoked tới room của user
    try {
      if (this.appGateway?.server && revokedSessionIds.length > 0) {
        this.appGateway.server.to(`user_${userId}`).emit("session_revoked", {
          revokedSessionIds,
        });
      }
    } catch (err) {
      this.logger.error("Lỗi khi bắn WebSocket session_revoked: " + String(err));
    }

    return {
      success: true,
      message: "Đã đăng xuất tất cả thiết bị khác thành công",
      revokedCount: revokedSessionIds.length,
    };
  }

  async updateCurrentSessionLocation(
    userId: string,
    currentToken: string,
    userAgent: string,
    city: string,
    country: string,
  ): Promise<void> {
    if (!currentToken || !userId) return;
    try {
      const sessionId = this.extractSessionId(currentToken, userAgent);
      if (!sessionId) return;

      await this.sessionModel.updateOne(
        { sessionId, userId },
        { $set: { city, country, isGps: true } }
      );
    } catch (e) {
      this.logger.error("Lỗi khi cập nhật vị trí GPS cho session: " + String(e));
    }
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

    // ── Tạo deviceName dạng Chrome-Windows ──
    const cleanBrowser = browser.replace(/\s+/g, "");
    const cleanOs = os.replace(/\s+/g, "");
    let deviceName: string;
    if (cleanOs.toLowerCase() !== "khôngrõ") {
      deviceName = `${cleanBrowser}-${cleanOs}`;
    } else {
      deviceName = cleanBrowser;
    }

    return { deviceName, os, browser, isMobile, isDesktop };
  }
}
