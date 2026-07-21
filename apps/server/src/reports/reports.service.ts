import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Report, ReportDocument } from "./schemas/report.schema";
import { RoomReport, RoomReportDocument } from "../rooms/schemas/room-report.schema";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { CreateReportDto } from "./dto/create-report.dto";
import { CreateRoomReportDto, UpdateRoomReportStatusDto } from "./dto/create-room-report.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as nodemailer from "nodemailer";
import { MeetingsService } from "../meetings/meetings.service";

@Injectable()
export class ReportsService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(RoomReport.name)
    private readonly roomReportModel: Model<RoomReportDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => MeetingsService))
    private readonly meetingsService: MeetingsService,
  ) {
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

  async createReport(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<ReportDocument> {
    // 4. Chống spam: Mỗi người dùng chỉ được có 01 báo cáo chưa xử lý đối với cùng một người dùng
    const existingReport = await this.reportModel
      .findOne({
        reporterId,
        reportedUserId: dto.reportedUserId,
        status: { $in: ["PENDING", "UNDER_REVIEW"] },
      })
      .exec();

    if (existingReport) {
      throw new BadRequestException(
        "Bạn đã gửi báo cáo đối với người dùng này. Vui lòng chờ quản trị viên xử lý.",
      );
    }

    const newReport = new this.reportModel({
      reporterId,
      reportedUserId: dto.reportedUserId,
      reason: dto.reason,
      description: dto.description || "",
      status: "PENDING",
      evidences: dto.evidences || [],
      roomInfo: dto.roomId || dto.roomName ? {
        roomId: dto.roomId,
        roomName: dto.roomName,
        roomCode: dto.roomCode,
        occurredAt: new Date(),
      } : undefined,
      createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    });

    return newReport.save();
  }

  /**
   * Tạo báo cáo phòng mới
   */
  async createRoomReport(
    reporterId: string,
    dto: CreateRoomReportDto,
  ): Promise<RoomReportDocument> {
    const room = await this.roomModel.findById(dto.roomId).exec();
    if (!room) {
      throw new NotFoundException("Phòng họp không tồn tại");
    }

    if (room.ownerId === reporterId) {
      throw new BadRequestException("Bạn không thể tự báo cáo phòng họp của mình");
    }

    // Kiểm tra xem reporter có phải là thành viên trong phòng họp này không
    const isMember = room.members.some(
      (member) => member.userId === reporterId && member.status === "ACTIVE",
    );
    if (!isMember && room.ownerId !== reporterId) {
      throw new BadRequestException("Chỉ thành viên đã tham gia phòng mới được phép báo cáo");
    }

    // Kiểm tra xem đã báo cáo phòng này chưa
    const existingReport = await this.roomReportModel
      .findOne({ roomId: dto.roomId, reporterId })
      .exec();
    if (existingReport) {
      throw new BadRequestException("Bạn đã gửi báo cáo cho phòng này.");
    }

    const newReport = new this.roomReportModel({
      roomId: dto.roomId,
      roomName: room.name,
      roomOwner: room.ownerId,
      reporterId,
      reason: dto.reason,
      description: dto.description || "",
      attachments: dto.attachments || [],
      status: "PENDING",
    });

    const savedReport = await newReport.save();

    // Gửi sự kiện tạo thông báo hệ thống realtime
    this.eventEmitter.emit("notification.room_reported", {
      userId: room.ownerId,
      metadata: {
        roomId: room._id.toString(),
        roomName: room.name,
        reason: dto.reason,
      },
    });

    return savedReport;
  }

  /**
   * Lấy danh sách báo cáo phòng dành cho Admin
   */
  async getRoomReports(
    filters: { status?: string; search?: string },
    page = 1,
    limit = 10,
  ) {
    const query: any = {};
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.search) {
      query.$or = [
        { roomName: new RegExp(filters.search, "i") },
        { reason: new RegExp(filters.search, "i") },
      ];
    }

    const total = await this.roomReportModel.countDocuments(query).exec();
    const reports = await this.roomReportModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    // Điền thêm thông tin user detail
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const reporter = await this.userModel.findOne({ supabaseId: report.reporterId }).exec();
        const owner = await this.userModel.findOne({ supabaseId: report.roomOwner }).exec();
        return {
          ...report.toObject(),
          reporterName: reporter?.displayName || "Người dùng ẩn danh",
          reporterEmail: reporter?.email || "",
          ownerName: owner?.displayName || "Chủ phòng ẩn danh",
          ownerEmail: owner?.email || "",
        };
      }),
    );

    return {
      reports: enrichedReports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Chi tiết báo cáo phòng
   */
  async getRoomReportById(id: string) {
    const report = await this.roomReportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException("Không tìm thấy báo cáo phòng này");
    }

    const room = await this.roomModel.findById(report.roomId).exec();
    const reporter = await this.userModel.findOne({ supabaseId: report.reporterId }).exec();
    const owner = await this.userModel.findOne({ supabaseId: report.roomOwner }).exec();

    return {
      ...report.toObject(),
      roomInfo: room
        ? {
            name: room.name,
            code: room.code,
            type: room.type,
            memberCount: room.members.length,
            createdAt: (room as any).createdAt,
          }
        : null,
      reporter: reporter
        ? {
            displayName: reporter.displayName,
            email: reporter.email,
            avatarUrl: reporter.avatarUrl,
          }
        : null,
      owner: owner
        ? {
            displayName: owner.displayName,
            email: owner.email,
            avatarUrl: owner.avatarUrl,
          }
        : null,
    };
  }

  /**
   * Cập nhật trạng thái báo cáo phòng (Admin)
   */
  async updateRoomReportStatus(
    id: string,
    dto: UpdateRoomReportStatusDto,
  ) {
    const report = await this.roomReportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException("Báo cáo không tồn tại");
    }

    const fromStatus = report.status;
    report.status = dto.status;

    // Khởi tạo logs/notes nếu chưa tồn tại
    if (!report.processingLog) report.processingLog = [];
    if (!report.adminNotes) report.adminNotes = [];

    // Ghi nhận log xử lý
    report.processingLog.push({
      action: "STATUS_CHANGED",
      fromStatus,
      toStatus: dto.status,
      adminId: (dto as any).adminId || "admin-system",
      adminEmail: (dto as any).adminEmail || "admin@tobomeet.com",
      note: dto.note || "Cập nhật trạng thái báo cáo phòng họp.",
      timestamp: new Date(),
    });

    if (dto.note) {
      report.adminNotes.push({
        content: dto.note,
        adminId: (dto as any).adminId || "admin-system",
        adminEmail: (dto as any).adminEmail || "admin@tobomeet.com",
        createdAt: new Date(),
      });
    }

    await report.save();

    const room = await this.roomModel.findById(report.roomId).exec();
    const reporter = await this.userModel.findOne({ supabaseId: report.reporterId }).exec();
    const owner = await this.userModel.findOne({ supabaseId: report.roomOwner }).exec();

    // 1. Xử lý Action Khóa phòng vi phạm nếu được chọn (Chỉ đặt status = "blocked", không giải tán hay xóa vĩnh viễn)
    if (dto.actionResult === "blocked" && room) {
      room.status = "blocked";
      await room.save();

      // Kết thúc toàn bộ cuộc họp ongoing của phòng đó
      try {
        const activeMeetings = await this.meetingsService.getActiveMeeting(report.roomId, "");
        if (activeMeetings && activeMeetings.meetingCode) {
          await this.meetingsService.endMeetingByCode(activeMeetings.meetingCode);
        }
      } catch (err) {
        console.error("Lỗi khi dừng cuộc họp trực tiếp:", err);
      }
    }

    // 2. Gửi realtime notifications
    this.eventEmitter.emit("notification.report_resolved", {
      userId: report.reporterId,
      metadata: {
        reportId: report._id.toString(),
        roomName: report.roomName,
        status: dto.status,
        actionResult: dto.actionResult || "none",
      },
    });

    if (owner && dto.actionResult === "blocked") {
      this.eventEmitter.emit("notification.room_blocked", {
        userId: report.roomOwner,
        metadata: {
          roomId: report.roomId,
          roomName: report.roomName,
          reason: report.reason,
          actionResult: dto.actionResult || "none",
        },
      });
    }

    // 3. Gửi Email thông báo (Gửi bất đồng bộ ngầm, không blocking HTTP response của Admin)
    if (dto.status === "RESOLVED" || dto.status === "REJECTED") {
      const isBlocked = dto.actionResult === "blocked";
      const isApproved = dto.status === "RESOLVED";

      const subject = isBlocked
        ? `[ToboMeet Safety] Thông báo khóa phòng họp vi phạm: ${report.roomName}`
        : isApproved
        ? `[ToboMeet Safety] Báo cáo phòng họp "${report.roomName}" đã được phê duyệt`
        : `[ToboMeet Safety] Phản hồi về báo cáo phòng họp "${report.roomName}"`;

      const resultText = isBlocked
        ? "Đã xác minh vi phạm nghiêm trọng và khóa phòng họp"
        : isApproved
        ? "Báo cáo được phê duyệt (Đã ghi nhận & gửi nhắc nhở chủ phòng)"
        : "Báo cáo bị từ chối do chưa đủ cơ sở vi phạm";

      // Email cho người báo cáo
      if (reporter && reporter.email) {
        this.transporter
          .sendMail({
            from: `"ToboMeet Safety" <${process.env.SMTP_USER}>`,
            to: reporter.email,
            subject,
            html: `<p>Xin chào <strong>${reporter.displayName || "bạn"}</strong>,</p>
                   <p>Báo cáo phòng họp <strong>"${report.roomName}"</strong> của bạn đã được quản trị viên xử lý.</p>
                   <p><strong>Kết quả xử lý:</strong> ${resultText}</p>
                   <p><strong>Ghi chú từ Admin:</strong> ${dto.note || "Hệ thống đã ghi nhận phản hồi của bạn."}</p>
                   <p>Cảm ơn sự đóng góp của bạn để giữ cộng đồng ToboMeet an toàn.</p>`,
          })
          .catch((mailErr) => console.error("Lỗi gửi email cho reporter:", mailErr));
      }

      // Email cho chủ phòng bị báo cáo
      if (owner && owner.email) {
        const ownerContent = isBlocked
          ? `<p>Xin chào <strong>${owner.displayName || "Chủ phòng"}</strong>,</p>
             <p>Phòng họp <strong>"${report.roomName}"</strong> của bạn đã bị khóa vĩnh viễn do vi phạm chính sách cộng đồng (Lý do: ${report.reason}).</p>
             <p><strong>Nội dung xử lý từ Admin:</strong> ${dto.note || "Phòng họp đã giải tán."}</p>`
          : isApproved
          ? `<p>Xin chào <strong>${owner.displayName || "Chủ phòng"}</strong>,</p>
             <p>Phòng họp <strong>"${report.roomName}"</strong> của bạn nhận được phản ánh vi phạm (${report.reason}). Ban quản trị yêu cầu bạn kiểm tra và quản lý phòng họp tuân thủ quy định.</p>
             <p><strong>Nhắc nhở từ Admin:</strong> ${dto.note || "Vui lòng giữ trật tự và văn minh trong phòng họp."}</p>`
          : `<p>Xin chào <strong>${owner.displayName || "Chủ phòng"}</strong>,</p>
             <p>Phòng họp <strong>"${report.roomName}"</strong> của bạn đã được kiểm tra sau khi có báo cáo. Ban quản trị xác nhận phòng họp hiện tại tuân thủ quy định.</p>`;

        this.transporter
          .sendMail({
            from: `"ToboMeet Safety" <${process.env.SMTP_USER}>`,
            to: owner.email,
            subject,
            html: ownerContent,
          })
          .catch((mailErr) => console.error("Lỗi gửi email cho owner:", mailErr));
      }
    }

    return report;
  }
}
