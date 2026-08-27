import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { AdminRoomsService } from "./admin-rooms.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";

@Controller("admin/rooms")
@UseGuards(SupabaseGuard)
export class AdminRoomsController {
  constructor(private readonly adminRoomsService: AdminRoomsService) {}

  private checkAdmin(req) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }
  }

  @Get("stats")
  async getStats(@Req() req) {
    this.checkAdmin(req);
    return this.adminRoomsService.getStats();
  }

  @Get()
  async getRooms(
    @Req() req,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("timeRange") timeRange?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ) {
    this.checkAdmin(req);
    return this.adminRoomsService.getRoomsList({
      q,
      status,
      type,
      timeRange,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      sortBy,
      sortOrder,
    });
  }

  @Get(":id")
  async getRoomDetails(@Req() req, @Param("id") id: string) {
    this.checkAdmin(req);
    return this.adminRoomsService.getRoomDetails(id);
  }

  @Post(":id/disband")
  async disbandRoom(
    @Req() req,
    @Param("id") id: string,
    @Body("reason") reason?: string,
  ) {
    this.checkAdmin(req);
    if (!reason || !reason.trim()) {
      throw new BadRequestException("Vui lòng cung cấp lý do giải tán phòng");
    }
    return this.adminRoomsService.disbandRoom(id, reason.trim(), req.user.email);
  }

}
