import { Injectable, Inject, forwardRef, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as nodemailer from "nodemailer";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { Meeting, MeetingDocument } from "../meetings/schemas/meeting.schema";
import { MeetingsGateway } from "../meetings/meetings.gateway";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

@Injectable()
export class AdminService {
  private supabaseAdmin;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @Inject(forwardRef(() => MeetingsGateway))
    private readonly meetingsGateway: MeetingsGateway,
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

  logEmailDebug(message: string, error?: any) {
    try {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.join(process.cwd(), "debug_email.log");
      const time = new Date().toISOString();
      let logMsg = `[${time}] ${message}\n`;
      if (error) {
        logMsg += `[${time}] ERROR DETAILS: ${error.stack || error.message || JSON.stringify(error)}\n`;
      }
      fs.appendFileSync(logPath, logMsg);
      console.log(`[Email Log] ${message}`);
    } catch (e) {
      console.error("Không thể ghi file debug_email.log", e);
    }
  }

  async getDashboardStats() {
    const totalUsers = await this.userModel.countDocuments().exec();
    
    // Đếm lượng socket connected thực tế làm online users
    const onlineUsers = this.meetingsGateway.server?.engine?.clientsCount || 0;

    const activeMeetings = await this.meetingModel
      .countDocuments({ status: "ongoing" })
      .exec();

    const totalMeetings = await this.meetingModel.countDocuments().exec();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const roomsCreatedToday = await this.roomModel
      .countDocuments({ createdAt: { $gte: startOfDay } })
      .exec();

    // Tính thời lượng họp trung bình (phút) của cuộc họp đã kết thúc (status = "ended")
    const endedMeetings = await this.meetingModel
      .find({ status: "ended" })
      .exec();

    let totalDurationMinutes = 0;
    endedMeetings.forEach((m) => {
      const durationSeconds = (((m as any).updatedAt?.getTime() || 0) - ((m as any).createdAt?.getTime() || 0)) / 1000;
      totalDurationMinutes += durationSeconds / 60;
    });

    const averageMeetingDuration =
      endedMeetings.length > 0 ? Math.round(totalDurationMinutes / endedMeetings.length) : 0;

    // Lấy dữ liệu biểu đồ lượt sử dụng theo ngày (30 ngày gần nhất)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const meetings = await this.meetingModel
      .find({ createdAt: { $gte: thirtyDaysAgo } })
      .select("createdAt")
      .exec();

    // Group theo ngày định dạng YYYY-MM-DD
    const chartDataMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      chartDataMap[key] = 0;
    }

    meetings.forEach((m) => {
      const key = (m as any).createdAt ? (m as any).createdAt.toISOString().split("T")[0] : "";
      if (chartDataMap[key] !== undefined) {
        chartDataMap[key]++;
      }
    });

    const chartData = Object.keys(chartDataMap).map((date) => ({
      date,
      count: chartDataMap[date],
    }));

    // Hoạt động gần đây (Recent rooms/meetings)
    const recentRooms = await this.roomModel
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    const recentMeetings = await this.meetingModel
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    return {
      totalUsers,
      onlineUsers,
      activeMeetings,
      totalMeetings,
      roomsCreatedToday,
      averageMeetingDuration,
      chartData,
      recentRooms: recentRooms.map((r) => ({
        id: r._id,
        name: r.name,
        code: r.code,
        createdAt: (r as any).createdAt,
      })),
      recentMeetings: recentMeetings.map((m) => ({
        id: m._id,
        meetingCode: m.meetingCode,
        status: m.status,
        createdAt: (m as any).createdAt,
      })),
    };
  }

  async getUsersList(searchQuery?: string, page: number = 1, limit: number = 10) {
    const filter: any = {};
    if (searchQuery && searchQuery.trim()) {
      const searchRegex = new RegExp(searchQuery.trim(), "i");
      filter.$or = [
        { email: searchRegex },
        { displayName: searchRegex },
      ];
    }

    const total = await this.userModel.countDocuments(filter).exec();
    const skip = (page - 1) * limit;
    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const usersWithStatus = await Promise.all(
      users.map(async (u) => {
        let isLocked = false;
        let role = "user";
        try {
          const { data: { user: sbUser } } = await this.supabaseAdmin.auth.admin.getUserById(u.supabaseId);
          if (sbUser) {
            isLocked = !!(sbUser.banned_until && new Date(sbUser.banned_until) > new Date());
            role = sbUser.app_metadata?.role || "user";
          }
        } catch (e) {
          this.logEmailDebug(`Lỗi lấy user ${u.email} từ Supabase`, e);
        }
        return {
          id: u._id,
          supabaseId: u.supabaseId,
          email: u.email,
          displayName: u.displayName || "",
          avatarUrl: u.avatarUrl || "",
          role: role,
          status: isLocked ? "locked" : "active",
          createdAt: (u as any).createdAt,
        };
      })
    );

    return {
      users: usersWithStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createUserAccount(email: string, password?: string, displayName?: string, role?: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Kiểm tra Email tồn tại trong MongoDB trước để tránh gọi API Supabase không cần thiết
    const existingUser = await this.userModel.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") }
    }).exec();
    if (existingUser) {
      throw new ConflictException("Email đã tồn tại.");
    }

    // 2. Chuẩn bị mật khẩu
    const finalPassword = (password && password.trim()) ? password.trim() : "12345678";

    // 3. Tạo tài khoản trên Supabase Auth
    const { data: supabaseUser, error: supabaseError } =
      await this.supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: finalPassword,
        email_confirm: true,
        role: role || "user",
        app_metadata: { role: role || "user" },
        user_metadata: { displayName: displayName || normalizedEmail.split("@")[0] },
      });

    if (supabaseError || !supabaseUser?.user) {
      const errMsg = supabaseError?.message || "";
      if (errMsg.includes("already registered") || errMsg.includes("already exists")) {
        throw new ConflictException("Email đã tồn tại.");
      }
      throw new BadRequestException(
        "Không thể tạo tài khoản trên Supabase: " + (supabaseError?.message || "Lỗi không xác định")
      );
    }

    const supabaseId = supabaseUser.user.id;

    // 4. Tạo tài khoản trên MongoDB
    try {
      const newUser = await this.userModel.create({
        supabaseId,
        email: normalizedEmail,
        displayName: displayName || normalizedEmail.split("@")[0],
      });

      return {
        id: newUser._id,
        supabaseId: newUser.supabaseId,
        email: newUser.email,
        displayName: newUser.displayName,
        role: role || "user",
        status: "active",
        createdAt: (newUser as any).createdAt,
      };
    } catch (dbError) {
      // Rollback: Xóa tài khoản trên Supabase nếu lưu DB lỗi
      await this.supabaseAdmin.auth.admin.deleteUser(supabaseId);
      throw new BadRequestException("Lỗi lưu trữ dữ liệu MongoDB: " + dbError.message);
    }
  }

  async updateUserAccount(id: string, displayName: string, role: string, status: string, adminEmail?: string) {
    this.logEmailDebug(`[Debug 1/4] Nhận yêu cầu cập nhật tài khoản: id=${id}, status=${status}`);
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException("Người dùng không tồn tại");
    }

    // Lấy thông tin tài khoản từ Supabase Auth
    const { data: { user: sbUser }, error: getSbError } = await this.supabaseAdmin.auth.admin.getUserById(user.supabaseId);
    if (getSbError || !sbUser) {
      throw new BadRequestException("Không tìm thấy tài khoản tương ứng trên Supabase");
    }

    const wasLocked = !!(sbUser.banned_until && new Date(sbUser.banned_until) > new Date());
    const isLocked = status === "locked";

    this.logEmailDebug(`[Debug 2/4] Kiểm tra chuyển đổi trạng thái: wasLocked=${wasLocked} -> isLocked=${isLocked}`);

    user.displayName = displayName;
    await user.save();

    let emailWarning: string | undefined = undefined;

    // Cập nhật vai trò (role) lên Supabase
    const { error: roleError } = await this.supabaseAdmin.auth.admin.updateUserById(
      user.supabaseId,
      {
        role: role,
        app_metadata: { role: role }
      }
    );
    if (roleError) {
      this.logEmailDebug(`Lỗi cập nhật role sang Supabase: ${roleError.message || JSON.stringify(roleError)}`);
    }

    // Nếu thay đổi trạng thái hoạt động, đồng bộ Khóa/Mở khóa vào Supabase Auth
    if (wasLocked !== isLocked) {
      const banDuration = isLocked ? "876000h" : "none"; // 100 năm hoặc none
      const { error: banError } = await this.supabaseAdmin.auth.admin.updateUserById(
        user.supabaseId,
        { ban_duration: banDuration }
      );
      if (banError) {
        this.logEmailDebug(`Lỗi đồng bộ trạng thái khóa sang Supabase: ${banError.message || JSON.stringify(banError)}`);
      }

      if (isLocked) {
        const { error: signOutError } = await this.supabaseAdmin.auth.admin.signOut(user.supabaseId);
        if (signOutError) {
          this.logEmailDebug(`Lỗi thu hồi phiên đăng nhập trên Supabase: ${signOutError.message}`);
        } else {
          this.logEmailDebug(`Đã thu hồi tất cả phiên hoạt động của người dùng ${user.email} trên Supabase`);
        }

        this.logEmailDebug(`[Debug 3/4] Bắt đầu gọi sendLockEmail cho email: ${user.email}`);
        try {
          await this.sendLockEmail(user.email);
          this.logEmailDebug(`[Debug 4/4] Gửi email thành công tới ${user.email}`);
        } catch (err: any) {
          this.logEmailDebug(`[Debug ERROR] Gửi email thất bại đến ${user.email}`, err);
          emailWarning = `Gửi email thông báo khóa đến người dùng thất bại. Chi tiết lỗi: ${err.message || err}`;
        }
      } else {
        this.logEmailDebug(`[Debug 3/4] Bắt đầu gọi sendUnlockEmail cho email: ${user.email}`);
        try {
          await this.sendUnlockEmail(user.email);
          this.logEmailDebug(`[Debug 4/4] Gửi email mở khóa thành công tới ${user.email}`);
        } catch (err: any) {
          this.logEmailDebug(`[Debug ERROR] Gửi email mở khóa thất bại đến ${user.email}`, err);
          emailWarning = `Gửi email thông báo mở khóa đến người dùng thất bại. Chi tiết lỗi: ${err.message || err}`;
        }
      }
    }

    return {
      id: user._id,
      supabaseId: user.supabaseId,
      email: user.email,
      displayName: user.displayName,
      role: role,
      status: isLocked ? "locked" : "active",
      createdAt: (user as any).createdAt,
      emailWarning,
    };
  }

  async sendLockEmail(email: string) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT") || 587;
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");
    const from = this.configService.get<string>("SMTP_FROM") || '"ToboMeet Support" <noreply@tobomeet.com>';

    this.logEmailDebug(`[SMTP Config] host=${host || 'missing'}, port=${port}, user=${user || 'missing'}, pass=${pass ? '***' : 'missing'}`);

    if (!host || !user || !pass) {
      throw new Error("Cấu hình SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) bị thiếu trong file .env của server.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const mailOptions = {
      from,
      to: email,
      subject: "Thông báo tài khoản bị khóa",
      text: `Chào bạn,

Tài khoản của bạn trên hệ thống ToboMeet đã bị khóa bởi Quản trị viên.
Bạn sẽ không thể đăng nhập vào hệ thống cho đến khi tài khoản được mở khóa.

Nếu bạn cần hỗ trợ hoặc cho rằng đây là một sự nhầm lẫn, vui lòng liên hệ với Quản trị viên của chúng tôi.

Trân trọng,
Đội ngũ hỗ trợ ToboMeet`,
    };

    await transporter.sendMail(mailOptions);
  }

  async sendUnlockEmail(email: string) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT") || 587;
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");
    const from = this.configService.get<string>("SMTP_FROM") || '"ToboMeet Support" <noreply@tobomeet.com>';

    this.logEmailDebug(`[SMTP Config] host=${host || 'missing'}, port=${port}, user=${user || 'missing'}, pass=${pass ? '***' : 'missing'}`);

    if (!host || !user || !pass) {
      throw new Error("Cấu hình SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) bị thiếu trong file .env của server.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const mailOptions = {
      from,
      to: email,
      subject: "Thông báo tài khoản đã được mở khóa",
      text: `Chào bạn,

Tài khoản của bạn trên hệ thống ToboMeet đã được mở khóa bởi Quản trị viên.
Bạn có thể đăng nhập và sử dụng hệ thống bình thường kể từ bây giờ.

Nếu bạn vẫn gặp sự cố khi đăng nhập, vui lòng liên hệ với Quản trị viên của chúng tôi để được hỗ trợ.

Trân trọng,
Đội ngũ hỗ trợ ToboMeet`,
    };

    await transporter.sendMail(mailOptions);
  }

  generateRandomPassword(): string {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+";
    
    let password = "";
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));
    
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = 0; i < 6; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }

  async sendResetPasswordEmail(email: string, newPassword: string) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT") || 587;
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");
    const from = this.configService.get<string>("SMTP_FROM") || '"ToboMeet Support" <noreply@tobomeet.com>';

    this.logEmailDebug(`[SMTP Config] host=${host || 'missing'}, port=${port}, user=${user || 'missing'}, pass=${pass ? '***' : 'missing'}`);

    if (!host || !user || !pass) {
      throw new Error("Cấu hình SMTP bị thiếu.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const mailOptions = {
      from,
      to: email,
      subject: "Mật khẩu tài khoản đã được đặt lại",
      text: `Xin chào,

Quản trị viên đã đặt lại mật khẩu cho tài khoản của bạn.

Mật khẩu mới:

${newPassword}

Bạn có thể sử dụng mật khẩu này để đăng nhập vào hệ thống.

Để đảm bảo an toàn, vui lòng đổi mật khẩu sau khi đăng nhập.

Trân trọng,
Đội ngũ hỗ trợ ToboMeet`,
    };

    await transporter.sendMail(mailOptions);
  }

  async resetUserPassword(id: string, adminEmail: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException("Người dùng không tồn tại");
    }

    // Kiểm tra trạng thái khóa từ Supabase Auth
    const { data: { user: sbUser }, error: getSbError } = await this.supabaseAdmin.auth.admin.getUserById(user.supabaseId);
    if (getSbError || !sbUser) {
      throw new BadRequestException("Không tìm thấy tài khoản tương ứng trên Supabase");
    }

    const isLocked = sbUser.banned_until && new Date(sbUser.banned_until) > new Date();
    if (isLocked) {
      throw new ForbiddenException("Tài khoản này đang bị khóa. Vui lòng mở khóa trước khi đặt lại mật khẩu.");
    }

    // Sinh mật khẩu ngẫu nhiên
    const randomPassword = this.generateRandomPassword();

    // Cập nhật trực tiếp mật khẩu người dùng trên Supabase qua Admin Auth API
    const { error: resetError } = await this.supabaseAdmin.auth.admin.updateUserById(
      user.supabaseId,
      { password: randomPassword }
    );

    if (resetError) {
      throw new BadRequestException("Không thể đặt lại mật khẩu: " + resetError.message);
    }

    // Gửi email tùy chỉnh qua SMTP
    try {
      await this.sendResetPasswordEmail(user.email, randomPassword);
    } catch (emailErr: any) {
      this.logEmailDebug(`Gửi email mật khẩu mới thất bại đến ${user.email}`, emailErr);
    }

    // Ghi Audit Log vào audit.log
    try {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.join(process.cwd(), "audit.log");
      const time = new Date().toISOString();
      const logMsg = `[${time}] Admin: ${adminEmail} | Target User: ${user.email} | Action: Yêu cầu đặt lại mật khẩu.\n`;
      fs.appendFileSync(logPath, logMsg);
    } catch (e) {
      console.error("Không thể ghi file audit.log", e);
    }

    return { success: true, message: "Đã đặt lại mật khẩu thành công và gửi mật khẩu mới đến email của người dùng." };
  }

  async sendDeleteEmail(email: string) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT") || 587;
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");
    const from = this.configService.get<string>("SMTP_FROM") || '"ToboMeet Support" <noreply@tobomeet.com>';

    this.logEmailDebug(`[SMTP Config] host=${host || 'missing'}, port=${port}, user=${user || 'missing'}, pass=${pass ? '***' : 'missing'}`);

    if (!host || !user || !pass) {
      throw new Error("Cấu hình SMTP bị thiếu.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const mailOptions = {
      from,
      to: email,
      subject: "Thông báo tài khoản bị xóa vĩnh viễn",
      text: `Chào bạn,

Tài khoản của bạn trên hệ thống ToboMeet đã bị xóa vĩnh viễn bởi Quản trị viên.
Bạn sẽ không thể tiếp tục đăng nhập hoặc sử dụng hệ thống này nữa.

Trân trọng,
Đội ngũ hỗ trợ ToboMeet`,
    };

    await transporter.sendMail(mailOptions);
  }

  async deleteUserAccount(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException("Người dùng không tồn tại");
    }

    // 1. Gửi email thông báo xóa vĩnh viễn trước khi xóa
    this.logEmailDebug(`[Debug] Bắt đầu gọi sendDeleteEmail cho email: ${user.email}`);
    try {
      await this.sendDeleteEmail(user.email);
      this.logEmailDebug(`[Debug] Đã gửi email xóa vĩnh viễn thành công tới ${user.email}`);
    } catch (err: any) {
      this.logEmailDebug(`[Debug ERROR] Gửi email xóa vĩnh viễn thất bại đến ${user.email}`, err);
    }

    // 2. Xóa trên Supabase
    const { error: deleteError } = await this.supabaseAdmin.auth.admin.deleteUser(
      user.supabaseId
    );

    if (deleteError) {
      console.warn("Cảnh báo: Lỗi xóa trên Supabase Auth (hoặc tài khoản đã bị xóa trước):", deleteError.message);
    }

    // 3. Xóa hoàn toàn bản ghi trong MongoDB
    await this.userModel.deleteOne({ _id: user._id }).exec();

    return { success: true, message: "Đã xóa tài khoản vĩnh viễn thành công" };
  }
}
