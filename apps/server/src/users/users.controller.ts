import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { SupabaseGuard } from "../auth/supabase.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseGuard)
  @Get("me")
  async getMe(@Request() req) {
    const userDoc = await this.usersService.getOrCreateUser(req.user);
    return userDoc;
  }
}
