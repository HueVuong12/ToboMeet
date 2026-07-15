import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { CreateReportDto } from "./dto/create-report.dto";
import { ReportsService } from "./reports.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { Request } from "express";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller("reports")
@UseGuards(SupabaseGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async createReport(
    @Body() dto: CreateReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const reporterId = req.user.id;
    const { reportedUserId, reason, description } = dto;

    if (!reportedUserId) {
      throw new BadRequestException("reportedUserId là bắt buộc");
    }

    if (!reason) {
      throw new BadRequestException("Lý do báo cáo là bắt buộc");
    }

    const validReasons = [
      "Spam",
      "Quấy rối",
      "Ngôn từ xúc phạm",
      "Chia sẻ nội dung không phù hợp",
      "Mạo danh",
      "Khác",
    ];

    if (!validReasons.includes(reason)) {
      throw new BadRequestException("Lý do báo cáo không hợp lệ");
    }

    if (reason === "Khác" && (!description || !description.trim())) {
      throw new BadRequestException(
        "Vui lòng nhập mô tả chi tiết khi chọn lý do 'Khác'",
      );
    }

    if (reporterId === reportedUserId) {
      throw new BadRequestException("Bạn không thể tự báo cáo chính mình");
    }

    return this.reportsService.createReport(reporterId, dto);
  }
}
