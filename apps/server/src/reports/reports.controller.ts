import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { CreateReportDto } from "./dto/create-report.dto";
import { CreateRoomReportDto } from "./dto/create-room-report.dto";
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

  @Post("room")
  async createRoomReport(
    @Body() dto: CreateRoomReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const reporterId = req.user.id;
    const { roomId, reason, description } = dto;

    if (!roomId) {
      throw new BadRequestException("roomId là bắt buộc");
    }

    if (!reason) {
      throw new BadRequestException("Lý do báo cáo phòng là bắt buộc");
    }

    const validReasons = [
      "Quấy rối",
      "Spam",
      "Nội dung phản cảm",
      "Lừa đảo",
      "Chia sẻ thông tin sai sự thật",
      "Vi phạm bản quyền",
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

    return this.reportsService.createRoomReport(reporterId, dto);
  }
}
