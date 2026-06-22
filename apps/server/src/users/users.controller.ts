import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { SupabaseGuard } from "../auth/supabase.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseGuard) // Yêu cầu phải có token Supabase hợp lệ
  @Get("me")
  async getMe(@Request() req) {
    // req.user ở đây chính là dữ liệu được Inject từ SupabaseGuard
    const user = await this.usersService.findOrCreate(req.user);

    return {
      message: "Lấy thông tin thành công",
      data: user,
    };
  }
}
