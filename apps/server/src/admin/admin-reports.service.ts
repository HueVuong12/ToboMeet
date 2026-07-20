import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Report, ReportDocument } from "../reports/schemas/report.schema";
import { User, UserDocument } from "../users/schemas/user.schema";

// ─── Valid status transitions ──────────────────────────────────────────────────
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["INVESTIGATING", "REJECTED"],
  INVESTIGATING: ["RESOLVED", "REJECTED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  REJECTED: [],
  CLOSED: [],
};

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // ─── Dashboard Statistics ─────────────────────────────────────────────────────
  async getReportStats(range: string = "7d") {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      total,
      pending,
      investigating,
      resolved,
      rejected,
      closed,
      todayCount,
    ] = await Promise.all([
      this.reportModel.countDocuments().exec(),
      this.reportModel.countDocuments({ status: "PENDING" }).exec(),
      this.reportModel.countDocuments({ status: "INVESTIGATING" }).exec(),
      this.reportModel.countDocuments({ status: "RESOLVED" }).exec(),
      this.reportModel.countDocuments({ status: "REJECTED" }).exec(),
      this.reportModel.countDocuments({ status: "CLOSED" }).exec(),
      this.reportModel
        .countDocuments({ createdAt: { $gte: startOfToday } })
        .exec(),
    ]);

    let chartData: { date: string; count: number }[] = [];
    const timezone = "+07:00";

    if (range === "today") {
      // Group by hour for today (00h - 23h)
      const hourlyData = await this.reportModel.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        {
          $group: {
            _id: {
              $hour: { date: "$createdAt", timezone },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      // Fill hours 0 to 23
      for (let h = 0; h < 24; h++) {
        const found = hourlyData.find((x) => x._id === h);
        chartData.push({
          date: `${String(h).padStart(2, "0")}h`,
          count: found ? found.count : 0,
        });
      }
    } else if (range === "7d" || range === "30d") {
      const days = range === "7d" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);

      const dailyData = await this.reportModel.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%d/%m", date: "$createdAt", timezone },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = String(d.getDate()).padStart(2, "0");
        const monthStr = String(d.getMonth() + 1).padStart(2, "0");
        const key = `${dayStr}/${monthStr}`;
        const found = dailyData.find((x) => x._id === key);
        chartData.push({ date: key, count: found ? found.count : 0 });
      }
    } else if (range === "3m") {
      // Group by week (last 12 weeks)
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks
      twelveWeeksAgo.setHours(0, 0, 0, 0);

      const weeklyData = await this.reportModel.aggregate([
        { $match: { createdAt: { $gte: twelveWeeksAgo } } },
        {
          $group: {
            _id: {
              // Group by week of the year
              $week: { date: "$createdAt", timezone },
            },
            count: { $sum: 1 },
            // Keep a sample date to format
            sampleDate: { $first: "$createdAt" },
          },
        },
      ]);

      // Fill 12 weeks
      for (let i = 11; i >= 0; i--) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - i * 7);
        // Find Monday of that week
        const day = targetDate.getDay();
        const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(targetDate.setDate(diff));
        
        const dayStr = String(monday.getDate()).padStart(2, "0");
        const monthStr = String(monday.getMonth() + 1).padStart(2, "0");
        const label = `W${dayStr}/${monthStr}`;

        // Get mongo week number
        const temp = new Date(monday);
        // Simple approximation of week number
        const startOfYear = new Date(temp.getFullYear(), 0, 1);
        const pastDaysOfYear = (temp.getTime() - startOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7) - 1;

        const found = weeklyData.find((x) => x._id === weekNum);
        chartData.push({ date: label, count: found ? found.count : 0 });
      }
    } else if (range === "1y") {
      // Group by month (last 12 months)
      const oneYearAgo = new Date();
      oneYearAgo.setMonth(oneYearAgo.getMonth() - 11);
      oneYearAgo.setDate(1);
      oneYearAgo.setHours(0, 0, 0, 0);

      const monthlyData = await this.reportModel.aggregate([
        { $match: { createdAt: { $gte: oneYearAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%m/%Y", date: "$createdAt", timezone },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = String(d.getMonth() + 1).padStart(2, "0");
        const yearStr = d.getFullYear();
        const key = `${monthStr}/${yearStr}`;
        const found = monthlyData.find((x) => x._id === key);
        chartData.push({ date: key, count: found ? found.count : 0 });
      }
    }

    // By status
    const byStatus = [
      { status: "PENDING", count: pending, label: "Chờ xử lý" },
      { status: "INVESTIGATING", count: investigating, label: "Đang xem xét" },
      { status: "RESOLVED", count: resolved, label: "Đã xử lý" },
      { status: "REJECTED", count: rejected, label: "Từ chối" },
      { status: "CLOSED", count: closed, label: "Đã đóng" },
    ];

    // By reason/type
    const byType = await this.reportModel.aggregate([
      {
        $group: {
          _id: "$reason",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    let activitiesStartDate = startOfToday;
    if (range === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      activitiesStartDate = d;
    } else if (range === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      d.setHours(0, 0, 0, 0);
      activitiesStartDate = d;
    } else if (range === "3m") {
      const d = new Date();
      d.setDate(d.getDate() - 84);
      d.setHours(0, 0, 0, 0);
      activitiesStartDate = d;
    } else if (range === "1y") {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      activitiesStartDate = d;
    }

    // Query các báo cáo được tạo mới hoặc có log hoạt động trong range
    const reportsWithActivities = await this.reportModel
      .find({
        $or: [
          { createdAt: { $gte: activitiesStartDate } },
          { "processingLog.timestamp": { $gte: activitiesStartDate } },
        ],
      })
      .select("reason status createdAt processingLog")
      .lean()
      .exec();

    const activitiesList: any[] = [];
    try {
      reportsWithActivities.forEach((report: any) => {
        if (!report || !report._id) return;
        const reportIdStr = report._id.toString();

        // 1. Tạo hoạt động CREATED
        if (report.createdAt) {
          const createdTime = new Date(report.createdAt);
          if (createdTime >= activitiesStartDate) {
            activitiesList.push({
              id: `${reportIdStr}-created`,
              timestamp: createdTime,
              reportId: reportIdStr,
              reason: report.reason || "Khác",
              action: "CREATED",
              status: "PENDING",
              note: "Người dùng đã gửi báo cáo mới.",
            });
          }
        }

        // 2. Tạo các hoạt động xử lý từ processingLog
        if (report.processingLog && Array.isArray(report.processingLog)) {
          report.processingLog.forEach((log: any, idx: number) => {
            if (!log || !log.timestamp) return;
            const logTime = new Date(log.timestamp);
            if (logTime >= activitiesStartDate) {
              activitiesList.push({
                id: `${reportIdStr}-log-${idx}`,
                timestamp: logTime,
                reportId: reportIdStr,
                reason: report.reason || "Khác",
                action: log.action || "STATUS_CHANGED",
                fromStatus: log.fromStatus,
                toStatus: log.toStatus,
                adminEmail: log.adminEmail || "admin@tobomeet.com",
                status: log.toStatus || report.status || "PENDING",
                note: log.note,
              });
            }
          });
        }
      });
    } catch (err) {
      console.error("Error formatting recent report activities:", err);
    }

    const recentActivities = activitiesList
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      total,
      pending,
      investigating,
      resolved,
      rejected,
      closed,
      today: todayCount,
      chartData,
      byStatus,
      byType: byType.map((x) => ({ type: x._id, count: x.count })),
      recentActivities,
    };
  }

  // ─── List Reports ─────────────────────────────────────────────────────────────
  async getReportsList(params: {
    page?: number;
    limit?: number;
    status?: string;
    reason?: string;
    hasEvidence?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const {
      page = 1,
      limit = 10,
      status,
      reason,
      hasEvidence,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (reason) filter.reason = reason;

    if (hasEvidence === "true") {
      filter["evidences.0"] = { $exists: true };
    } else if (hasEvidence === "false") {
      filter["evidences.0"] = { $exists: false };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (page - 1) * limit;
    const sortDir = sortOrder === "asc" ? 1 : -1;

    const [reports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.reportModel.countDocuments(filter).exec(),
    ]);

    // Enrich with user info from MongoDB users collection
    const enriched = await this.enrichReportsWithUsers(reports);

    // Apply search filter (after enrichment, on name/email/id)
    let filtered = enriched;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = enriched.filter((r) => {
        return (
          String(r._id).toLowerCase().includes(q) ||
          r.reporter?.displayName?.toLowerCase().includes(q) ||
          r.reporter?.email?.toLowerCase().includes(q) ||
          r.reported?.displayName?.toLowerCase().includes(q) ||
          r.reported?.email?.toLowerCase().includes(q) ||
          r.roomInfo?.roomName?.toLowerCase().includes(q) ||
          r.roomInfo?.roomCode?.toLowerCase().includes(q) ||
          r.reason?.toLowerCase().includes(q)
        );
      });
    }

    return {
      reports: filtered,
      total: search ? filtered.length : total,
      page,
      limit,
      totalPages: Math.ceil((search ? filtered.length : total) / limit),
    };
  }

  // ─── Get Report By ID ─────────────────────────────────────────────────────────
  async getReportById(id: string) {
    const report = await this.reportModel.findById(id).lean().exec();
    if (!report) throw new NotFoundException("Không tìm thấy báo cáo");

    const [enriched] = await this.enrichReportsWithUsers([report]);
    return enriched;
  }

  // ─── Update Status ────────────────────────────────────────────────────────────
  async updateReportStatus(
    id: string,
    newStatus: string,
    adminId: string,
    adminEmail: string,
    note?: string,
  ) {
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException("Không tìm thấy báo cáo");

    const currentStatus = report.status;
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái "${currentStatus}" sang "${newStatus}"`,
      );
    }

    const logEntry: any = {
      action: "STATUS_CHANGED",
      fromStatus: currentStatus,
      toStatus: newStatus,
      adminId,
      adminEmail,
      note: note || "",
      timestamp: new Date(),
    };

    const update: any = {
      status: newStatus,
      $push: { processingLog: logEntry },
    };

    if (newStatus === "RESOLVED") update.resolvedAt = new Date();
    if (newStatus === "CLOSED") update.closedAt = new Date();

    await this.reportModel.findByIdAndUpdate(id, update).exec();

    return this.getReportById(id);
  }

  // ─── Add Admin Note ───────────────────────────────────────────────────────────
  async addAdminNote(
    id: string,
    content: string,
    adminId: string,
    adminEmail: string,
  ) {
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException("Không tìm thấy báo cáo");

    if (!content || !content.trim()) {
      throw new BadRequestException("Nội dung ghi chú không được để trống");
    }

    const noteEntry = {
      content: content.trim(),
      adminId,
      adminEmail,
      createdAt: new Date(),
    };

    const logEntry = {
      action: "NOTE_ADDED",
      adminId,
      adminEmail,
      note: content.trim(),
      timestamp: new Date(),
    };

    await this.reportModel
      .findByIdAndUpdate(id, {
        $push: {
          adminNotes: noteEntry,
          processingLog: logEntry,
        },
      })
      .exec();

    return this.getReportById(id);
  }

  // ─── Update Conclusion ────────────────────────────────────────────────────────
  async updateConclusion(
    id: string,
    conclusion: string,
    adminId: string,
    adminEmail: string,
  ) {
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException("Không tìm thấy báo cáo");

    const validConclusions = [
      "VIOLATED",
      "NOT_VIOLATED",
      "INSUFFICIENT_EVIDENCE",
    ];
    if (!validConclusions.includes(conclusion)) {
      throw new BadRequestException("Kết luận không hợp lệ");
    }

    const logEntry = {
      action: "CONCLUSION_SET",
      adminId,
      adminEmail,
      note: `Kết luận: ${conclusion}`,
      timestamp: new Date(),
    };

    await this.reportModel
      .findByIdAndUpdate(id, {
        conclusion,
        $push: { processingLog: logEntry },
      })
      .exec();

    return this.getReportById(id);
  }

  // ─── Export ───────────────────────────────────────────────────────────────────
  async exportReports(params: {
    status?: string;
    reason?: string;
    startDate?: string;
    endDate?: string;
    format?: string;
  }) {
    const filter: Record<string, any> = {};
    if (params.status) filter.status = params.status;
    if (params.reason) filter.reason = params.reason;
    if (params.startDate || params.endDate) {
      filter.createdAt = {};
      if (params.startDate) filter.createdAt.$gte = new Date(params.startDate);
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const reports = await this.reportModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean()
      .exec();

    const enriched = await this.enrichReportsWithUsers(reports);

    return enriched.map((r) => ({
      id: String(r._id),
      title: r.title || r.reason,
      reason: r.reason,
      description: r.description,
      status: r.status,
      conclusion: r.conclusion || "",
      reporterEmail: r.reporter?.email || r.reporterId,
      reporterName: r.reporter?.displayName || "",
      reportedEmail: r.reported?.email || r.reportedUserId,
      reportedName: r.reported?.displayName || "",
      roomName: r.roomInfo?.roomName || "",
      hasEvidence: (r.evidences?.length || 0) > 0 ? "Có" : "Không",
      createdAt: r.createdAt
        ? new Date(r.createdAt).toISOString()
        : "",
      resolvedAt: r.resolvedAt
        ? new Date(r.resolvedAt).toISOString()
        : "",
      closedAt: r.closedAt ? new Date(r.closedAt).toISOString() : "",
    }));
  }

  // ─── Helper: Enrich reports with user data ────────────────────────────────────
  private async enrichReportsWithUsers(reports: any[]) {
    if (!reports.length) return [];

    const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
    const reportedIds = [...new Set(reports.map((r) => r.reportedUserId))];
    const allIds = [...new Set([...reporterIds, ...reportedIds])];

    const users = await this.userModel
      .find({ supabaseId: { $in: allIds } })
      .lean()
      .exec();

    const userMap = new Map(users.map((u) => [u.supabaseId, u]));

    return reports.map((r) => ({
      ...r,
      reporter: userMap.get(r.reporterId) || null,
      reported: userMap.get(r.reportedUserId) || null,
    }));
  }
}
