// src/notifications/notifications.controller.ts
import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { GetNotificationsDto } from "./dto/get-notifications.dto";
import { SupabaseGuard } from "../core/guards/supabase.guard";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(SupabaseGuard)
  async getMyNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetNotificationsDto,
  ) {
    const userId = req.user.id;
    return this.notificationsService.getUserNotifications(userId, query);
  }
}
