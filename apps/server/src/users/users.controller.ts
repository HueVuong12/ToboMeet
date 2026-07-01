import {
  Controller,
  Get,
  Request,
  UseGuards,
  Delete,
  Param,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseGuard)
  @Get("me")
  async getMe(@Request() req) {
    const userDoc = await this.usersService.getOrCreateUser(req.user);
    return userDoc;
  }

  @UseGuards(SupabaseGuard)
  @Get("me/sessions")
  async getSessions(@Request() req) {
    const userId = req.user.id;
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    return this.usersService.getUserSessions(userId, token);
  }

  @UseGuards(SupabaseGuard)
  @Delete("me/sessions/:id")
  async revokeSession(@Param("id") sessionId: string, @Request() req) {
    const userId = req.user.id;
    return this.usersService.revokeSession(userId, sessionId);
  }
}
