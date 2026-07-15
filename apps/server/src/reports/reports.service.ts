import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Report, ReportDocument } from "./schemas/report.schema";
import { CreateReportDto } from "./dto/create-report.dto";

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
  ) {}

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
      createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    });

    return newReport.save();
  }
}
