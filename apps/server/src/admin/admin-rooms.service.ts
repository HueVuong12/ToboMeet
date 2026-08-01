import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import {
  RoomReport,
  RoomReportDocument,
} from "../rooms/schemas/room-report.schema";
import {
  RoomActivity,
  RoomActivityDocument,
} from "../rooms/schemas/room-activity.schema";
import { Meeting, MeetingDocument } from "../meetings/schemas/meeting.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { MeetingsService } from "../meetings/meetings.service";
import { MeetingsGateway } from "../meetings/meetings.gateway";
import * as path from "path";
import * as fs from "fs";
import * as nodemailer from "nodemailer";

@Injectable()
export class AdminRoomsService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomReport.name)
    private reportModel: Model<RoomReportDocument>,
    @InjectModel(RoomActivity.name)
    private activityModel: Model<RoomActivityDocument>,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly meetingsService: MeetingsService,
    @Inject(forwardRef(() => MeetingsGateway))
    private readonly meetingsGateway: MeetingsGateway,
  ) {
    // Khởi tạo mailer tương tự admin.service
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const secure = process.env.SMTP_SECURE === "true";
    const userMail = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: userMail,
        pass,
      },
    });
  }

  private logAudit(action: string, adminEmail: string, details: string) {
    try {
      const logPath = path.join(process.cwd(), "audit.log");
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ADMIN_ROOM_ACTION - ${adminEmail} - Action: ${action} - Details: ${details}\n`;
      fs.appendFileSync(logPath, logLine, "utf8");
    } catch (e) {
      console.error("Không thể ghi file audit.log", e);
    }
  }

  async getStats() {
    const [total, active, disbanded] = await Promise.all([
      this.roomModel.countDocuments({ isDeleted: { $ne: true } }),
      this.roomModel.countDocuments({
        status: "active",
        isDeleted: { $ne: true },
      }),
      this.roomModel.countDocuments({
        status: "disbanded",
        isDeleted: { $ne: true },
      }),
    ]);

    // Đếm số phòng bị báo cáo (có ít nhất 1 report)
    const reportedRooms = await this.reportModel.distinct("roomId");
    const reported = reportedRooms.length;

    return {
      total,
      active,
      disbanded,
      reported,
    };
  }

  async getRoomsList(queryDto: {
    q?: string;
    status?: string;
    type?: string;
    timeRange?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = { isDeleted: { $ne: true } };

    // Search query q
    if (queryDto.q) {
      const q = queryDto.q.trim();
      // Tìm theo name hoặc code
      const ownerIds = await this.userModel
        .find({
          $or: [
            { displayName: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        })
        .select("supabaseId")
        .exec();

      const ownerSupabaseIds = ownerIds.map((u) => u.supabaseId);

      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { ownerId: { $in: ownerSupabaseIds } },
      ];
    }

    // Filter status
    if (queryDto.status && queryDto.status !== "all") {
      filter.status = queryDto.status;
    }

    // Filter type
    if (queryDto.type && queryDto.type !== "all") {
      filter.type = queryDto.type;
    }

    // Filter time range
    if (queryDto.timeRange && queryDto.timeRange !== "all") {
      const now = new Date();
      if (queryDto.timeRange === "today") {
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        filter.createdAt = { $gte: startOfToday };
      } else if (queryDto.timeRange === "7days") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filter.createdAt = { $gte: sevenDaysAgo };
      } else if (queryDto.timeRange === "30days") {
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        filter.createdAt = { $gte: thirtyDaysAgo };
      } else if (
        queryDto.timeRange === "custom" &&
        queryDto.startDate &&
        queryDto.endDate
      ) {
        filter.createdAt = {
          $gte: new Date(queryDto.startDate),
          $lte: new Date(queryDto.endDate),
        };
      }
    }

    // Sort mapping
    const sort: Record<string, 1 | -1> = {};
    const sortBy = queryDto.sortBy || "createdAt";
    const sortOrder = queryDto.sortOrder === "asc" ? 1 : -1;
    if (sortBy === "name") {
      sort.name = sortOrder;
    } else if (sortBy === "membersCount") {
      // Vì members là array, sort theo membersCount khó hơn nếu dùng find, nhưng ở đây có thể sort theo members length
      // Mặc định sort theo createdAt
      sort.createdAt = sortOrder;
    } else {
      sort.createdAt = sortOrder;
    }

    const [rooms, total] = await Promise.all([
      this.roomModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.roomModel.countDocuments(filter),
    ]);

    // Fetch owners' user details
    const ownerIds = rooms.map((r) => r.ownerId);
    const users = await this.userModel
      .find({ supabaseId: { $in: ownerIds } })
      .exec();

    const roomsData = rooms.map((room) => {
      const owner = users.find((u) => u.supabaseId === room.ownerId);
      return {
        id: room._id,
        name: room.name,
        code: room.code,
        type: room.type,
        status: room.status || "active",
        createdAt: (room as unknown as { createdAt: Date }).createdAt,
        membersCount: room.members?.length || 0,
        owner: {
          displayName: owner?.displayName || "Người dùng ẩn danh",
          email: owner?.email || "",
        },
      };
    });

    return {
      rooms: roomsData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRoomDetails(roomId: string) {
    const room = await this.roomModel
      .findOne({ _id: roomId, isDeleted: { $ne: true } })
      .exec();
    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    // Fetch owner details
    const owner = await this.userModel
      .findOne({ supabaseId: room.ownerId })
      .exec();

    // Fetch all members' detailed info
    const memberUserIds = room.members.map((m) => m.userId);
    const users = await this.userModel
      .find({ supabaseId: { $in: memberUserIds } })
      .exec();

    const membersList = room.members.map((member) => {
      const u = users.find((userItem) => userItem.supabaseId === member.userId);
      return {
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        displayName: u?.displayName || "Người dùng ẩn danh",
        email: u?.email || "",
        avatarUrl: u?.avatarUrl || "",
        status: member.status === "left" ? "Đã rời" : "Đang trong phòng",
      };
    });

    // Fetch reports
    const reports = await this.reportModel.find({ roomId }).exec();
    const reporterIds = reports.map((rep) => rep.reporterId);
    const reporters = await this.userModel
      .find({ supabaseId: { $in: reporterIds } })
      .exec();

    const reportsList = reports.map((rep) => {
      const reporter = reporters.find((u) => u.supabaseId === rep.reporterId);
      return {
        id: rep._id,
        reporterName: reporter?.displayName || "Người dùng ẩn danh",
        reason: rep.reason,
        details: (rep as any).description || "",
        status: rep.status,
        createdAt: (rep as unknown as { createdAt: Date }).createdAt,
      };
    });

    // Fetch activity log (timeline)
    const activities = await this.activityModel
      .find({ roomId })
      .sort({ createdAt: 1 })
      .exec();

    // Stats calculations
    const totalParticipants =
      room.members?.filter((m) => m.status !== "left" && m.status !== "removed")
        .length || 0;

    let onlineParticipants = 0;
    if (room.members && room.members.length > 0) {
      for (const m of room.members) {
        if (m.status !== "left" && m.status !== "removed") {
          const userSocketRoom =
            this.meetingsGateway.server?.sockets?.adapter?.rooms?.get(
              `user_${m.userId}`,
            );
          if (userSocketRoom && userSocketRoom.size > 0) {
            onlineParticipants++;
          }
        }
      }
    }

    const totalChannels = room.channels?.length || 0;
    const totalMeetings =
      (await this.meetingModel.countDocuments({ roomId }).exec()) || 0;
    const totalMessages =
      (await this.activityModel
        .countDocuments({ roomId, type: "MESSAGE_SENT" })
        .exec()) || 0;
    const totalPolls =
      (await this.activityModel
        .countDocuments({ roomId, type: "POLL_CREATED" })
        .exec()) || 0;
    const totalWhiteboards =
      (await this.activityModel
        .countDocuments({ roomId, type: "WHITEBOARD_CREATED" })
        .exec()) || 0;

    const stats = {
      totalParticipants,
      onlineParticipants,
      totalChannels,
      totalMeetings,
      totalMessages,
      totalPolls,
      totalWhiteboards,
    };

    return {
      id: room._id,
      name: room.name,
      code: room.code,
      type: room.type,
      status: room.status || "active",
      createdAt: (room as unknown as { createdAt: Date }).createdAt,
      owner: {
        displayName: owner?.displayName || "Người dùng ẩn danh",
        email: owner?.email || "",
      },
      members: membersList,
      reports: reportsList,
      activities,
      stats,
    };
  }

  async disbandRoom(roomId: string, reason: string, adminEmail: string) {
    const room = await this.roomModel
      .findOne({ _id: roomId, isDeleted: { $ne: true } })
      .exec();
    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    if (room.status === "disbanded") {
      throw new BadRequestException("Phòng họp đã được giải tán trước đó");
    }

    // 1. Kick all participants using LiveKit server SDK via meetingsService
    try {
      // Tìm các meeting đang hoạt động thuộc phòng này và kết thúc chúng
      const activeMeetings = await this.meetingModel
        .find({ roomId: room._id.toString(), status: "ongoing" })
        .exec();
      for (const meeting of activeMeetings) {
        await this.meetingsService.endMeetingByCode(meeting.meetingCode);
      }
    } catch (err) {
      console.error("Lỗi khi kết thúc cuộc họp trên LiveKit:", err);
    }

    // 2. Update status to disbanded
    room.status = "disbanded";
    await room.save();

    // 3. Log RoomActivity
    await this.activityModel.create({
      roomId: room._id.toString(),
      type: "DISBANDED",
      metadata: {
        details: `Giải tán bởi Admin: ${reason}`,
        adminEmail,
      },
    });

    // 4. Log Audit Log
    this.logAudit(
      "DISBAND_ROOM",
      adminEmail,
      `Room: ${room.name} (${room.code}) - Reason: ${reason}`,
    );

    // 5. Send Email to Host
    const host = await this.userModel
      .findOne({ supabaseId: room.ownerId })
      .exec();
    if (host && host.email) {
      try {
        const mailOptions = {
          from: `"ToboMeet System" <${process.env.SMTP_USER}>`,
          to: host.email,
          subject: `[ToboMeet] Thông báo giải tán phòng họp: ${room.name}`,
          text: `Xin chào ${host.displayName || "chủ phòng"},\n\nPhòng họp "${room.name}" (Mã phòng: ${room.code}) của bạn đã bị Quản trị viên giải tán do vi phạm chính sách: ${reason}.\n\nMọi kết nối đến phòng đã bị ngắt. Vui lòng liên hệ hỗ trợ nếu cần thêm thông tin.\n\nTrân trọng,\nĐội ngũ ToboMeet.`,
          html: `<p>Xin chào <strong>${host.displayName || "chủ phòng"}</strong>,</p><p>Phòng họp <strong>"${room.name}"</strong> (Mã phòng: ${room.code}) của bạn đã bị Quản trị viên giải tán do vi phạm chính sách: <strong>${reason}</strong>.</p><p>Mọi kết nối đến phòng đã bị ngắt. Vui lòng liên hệ bộ phận hỗ trợ nếu cần biết thêm thông tin chi tiết.</p><p>Trân trọng,<br>Đội ngũ ToboMeet.</p>`,
        };
        await this.transporter.sendMail(mailOptions);
      } catch (mailErr) {
        console.error(
          `Không thể gửi email giải tán phòng đến ${host.email}:`,
          mailErr,
        );
      }
    }

    return { success: true, message: "Giải tán phòng họp thành công" };
  }
}
