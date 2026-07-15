import { Controller, Get, Post, Put, Delete, Body, Param, Query, BadRequestException, UseGuards, Req, ForbiddenException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";

@Controller("admin")
@UseGuards(SupabaseGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  async getStats(@Req() req) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }
    return this.adminService.getDashboardStats();
  }

  @Get("users")
  async getUsers(
    @Req() req,
    @Query("query") query?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getUsersList(query, pageNum, limitNum);
  }

  @Post("users")
  async createUser(
    @Req() req,
    @Body("email") email?: string,
    @Body("password") password?: string,
    @Body("role") role?: string,
  ) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }

    // 1. Validation email
    if (!email || !email.trim()) {
      throw new BadRequestException("Email là bắt buộc");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new BadRequestException("Email không đúng định dạng");
    }

    // 2. Validation password
    if (password && password.trim() && password.trim().length < 8) {
      throw new BadRequestException("Mật khẩu phải chứa ít nhất 8 ký tự");
    }

    // 3. Validation role
    if (!role || !role.trim()) {
      throw new BadRequestException("Vai trò là bắt buộc");
    }
    const trimmedRole = role.trim().toLowerCase();
    if (!["admin", "user"].includes(trimmedRole)) {
      throw new BadRequestException("Vai trò chỉ được phép là admin hoặc user");
    }

    return this.adminService.createUserAccount(
      email.trim(),
      password ? password.trim() : undefined,
      undefined, // displayName được tự sinh ra trong Service
      trimmedRole,
    );
  }

  @Put("users/:id")
  async updateUser(
    @Req() req,
    @Param("id") id: string,
    @Body("displayName") displayName?: string,
    @Body("role") role?: string,
    @Body("status") status?: string,
  ) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }

    const trimmedRole = role?.trim().toLowerCase();
    if (trimmedRole && !["admin", "user"].includes(trimmedRole)) {
      throw new BadRequestException("Vai trò chỉ được phép là admin hoặc user");
    }

    const trimmedStatus = status?.trim().toLowerCase();
    if (trimmedStatus && !["active", "locked"].includes(trimmedStatus)) {
      throw new BadRequestException("Trạng thái chỉ được phép là active hoặc locked");
    }

    return this.adminService.updateUserAccount(
      id,
      displayName || "",
      trimmedRole || "user",
      trimmedStatus || "active",
      req.user?.email || "admin",
    );
  }

  @Put("users/:id/reset-password")
  async resetPassword(
    @Req() req,
    @Param("id") id: string,
  ) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }

    const adminEmail = req.user?.email || "admin";
    return this.adminService.resetUserPassword(id, adminEmail);
  }

  @Delete("users/:id")
  async deleteUser(@Req() req, @Param("id") id: string) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }
    return this.adminService.deleteUserAccount(id);
  }

  // --- HỆ THỐNG XỬ LÝ VI PHẠM & KHÓA TÀI KHOẢN ---

  @Get("check-lock")
  async checkLock(@Query("email") email: string) {
    if (!email) {
      throw new BadRequestException("Email là bắt buộc");
    }
    return this.adminService.checkLockByEmail(email);
  }

  @Post("users/:id/lock")
  async lockUser(
    @Req() req,
    @Param("id") id: string,
    @Body("violationType") violationType: string,
    @Body("recommendedDuration") recommendedDuration: string,
    @Body("actualDuration") actualDuration: string,
    @Body("lockReason") lockReason: string,
    @Body("sendEmail") sendEmail: boolean,
    @Body("lockSource") lockSource?: string,
  ) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }

    if (!violationType || !actualDuration || !lockReason) {
      throw new BadRequestException("Thiếu thông tin vi phạm hoặc lý do khóa");
    }

    const adminEmail = req.user?.email || "admin";
    return this.adminService.lockUserAccount(
      id,
      {
        violationType,
        recommendedDuration,
        actualDuration,
        lockReason,
        sendEmail,
        lockSource: lockSource || "MANUAL",
      },
      adminEmail
    );
  }

  @Post("users/:id/unlock")
  async unlockUser(@Req() req, @Param("id") id: string) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }
    const adminEmail = req.user?.email || "admin";
    return this.adminService.unlockUserAccount(id, adminEmail);
  }

  @Post("users/:id/extend-lock")
  async extendUserLock(
    @Req() req,
    @Param("id") id: string,
    @Body("actualDuration") actualDuration: string,
    @Body("lockReason") lockReason: string,
  ) {
    if (req.user?.role !== "admin") {
      throw new ForbiddenException("Bạn không có quyền truy cập chức năng này.");
    }

    if (!actualDuration || !lockReason) {
      throw new BadRequestException("Thiếu thông tin thời gian gia hạn hoặc lý do");
    }

    const adminEmail = req.user?.email || "admin";
    return this.adminService.extendUserLock(
      id,
      {
        actualDuration,
        lockReason,
      },
      adminEmail
    );
  }
}
