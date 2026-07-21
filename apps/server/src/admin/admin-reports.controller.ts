import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { AdminReportsService } from "./admin-reports.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";

@Controller("admin/reports")
@UseGuards(SupabaseGuard)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  // ─── Guard helper ──────────────────────────────────────────────────────────────
  private checkAdmin(req: any) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException(
        "Bạn không có quyền truy cập chức năng này.",
      );
    }
  }

  // ─── Dashboard Stats ───────────────────────────────────────────────────────────
  @Get("stats")
  async getStats(@Req() req: any, @Query("range") range?: string) {
    this.checkAdmin(req);
    return this.adminReportsService.getReportStats(range);
  }

  // ─── Export ────────────────────────────────────────────────────────────────────
  @Get("export")
  async exportReports(
    @Req() req: any,
    @Query("status") status?: string,
    @Query("reason") reason?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("format") format?: string,
  ) {
    this.checkAdmin(req);
    return this.adminReportsService.exportReports({
      status,
      reason,
      startDate,
      endDate,
      format,
    });
  }

  // ─── List Reports ──────────────────────────────────────────────────────────────
  @Get()
  async getReports(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("reason") reason?: string,
    @Query("hasEvidence") hasEvidence?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ) {
    this.checkAdmin(req);
    return this.adminReportsService.getReportsList({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      status,
      reason,
      hasEvidence,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });
  }

  // ─── Get Single Report ─────────────────────────────────────────────────────────
  @Get(":id")
  async getReportById(@Req() req: any, @Param("id") id: string) {
    this.checkAdmin(req);
    return this.adminReportsService.getReportById(id);
  }

  // ─── Update Status ─────────────────────────────────────────────────────────────
  @Patch(":id/status")
  async updateStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body("status") status: string,
    @Body("note") note?: string,
  ) {
    this.checkAdmin(req);
    if (!status) throw new BadRequestException("Trạng thái là bắt buộc");

    return this.adminReportsService.updateReportStatus(
      id,
      status,
      req.user.id,
      req.user.email,
      note,
    );
  }

  // ─── Add Admin Note ────────────────────────────────────────────────────────────
  @Post(":id/notes")
  async addNote(
    @Req() req: any,
    @Param("id") id: string,
    @Body("content") content: string,
  ) {
    this.checkAdmin(req);
    if (!content || !content.trim()) {
      throw new BadRequestException("Nội dung ghi chú là bắt buộc");
    }

    return this.adminReportsService.addAdminNote(
      id,
      content,
      req.user.id,
      req.user.email,
    );
  }

  // ─── Update Conclusion ─────────────────────────────────────────────────────────
  @Patch(":id/conclusion")
  async updateConclusion(
    @Req() req: any,
    @Param("id") id: string,
    @Body("conclusion") conclusion: string,
  ) {
    this.checkAdmin(req);
    if (!conclusion) throw new BadRequestException("Kết luận là bắt buộc");

    return this.adminReportsService.updateConclusion(
      id,
      conclusion,
      req.user.id,
      req.user.email,
    );
  }

  // ─── Room Reports Endpoints ───────────────────────────────────────────────────
  @Get("rooms/list")
  async getRoomReports(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ) {
    this.checkAdmin(req);
    return this.adminReportsService.getRoomReportsList({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      status,
      search,
    });
  }

  @Get("rooms/:id")
  async getRoomReportById(@Req() req: any, @Param("id") id: string) {
    this.checkAdmin(req);
    return this.adminReportsService.getRoomReportDetails(id);
  }

  @Patch("rooms/:id/status")
  async updateRoomReportStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body("status") status: string,
    @Body("actionResult") actionResult?: "none" | "blocked" | "disbanded" | "warning",
    @Body("note") note?: string,
  ) {
    this.checkAdmin(req);
    if (!status) throw new BadRequestException("Trạng thái là bắt buộc");
    return this.adminReportsService.updateRoomReportStatus(id, {
      status: status as any,
      actionResult,
      note,
      adminId: req.user.id,
      adminEmail: req.user.email,
    });
  }
}
