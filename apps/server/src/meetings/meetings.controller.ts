// src/meetings/meetings.controller.ts
import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  Delete,
  Get,
} from "@nestjs/common";
import { MeetingsService } from "./meetings.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { RoomRoleGuard } from "../core/guards/room-role.guard";
import { Roles } from "../core/decorators/roles.decorator";
import { JoinMeetingDto } from "./dtos/join-meeting.dto";

@Controller("rooms/:id/channels/:channelId/meetings")
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * POST /api/rooms/:id/channels/:channelId/meetings/join
   * Mọi thành viên hợp lệ trong phòng đều có quyền gọi để Lấy Token (Join/Create)
   */
  @Post("join")
  @Roles("owner", "admin", "member")
  @UseGuards(SupabaseGuard, RoomRoleGuard)
  async joinMeeting(
    @Param("id") roomId: string,
    @Param("channelId") channelId: string,
    @Body() body: JoinMeetingDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.meetingsService.joinOrCreateMeeting(
      roomId,
      channelId,
      userId,
      body.displayName,
    );
  }

  /**
   * GET /api/rooms/:id/channels/:channelId/meetings/active
   * Lấy trạng thái cuộc họp đang diễn ra trong kênh
   */
  @Get("active")
  @UseGuards(SupabaseGuard, RoomRoleGuard)
  async getActiveMeeting(
    @Param("id") roomId: string,
    @Param("channelId") channelId: string,
  ) {
    return this.meetingsService.getActiveMeeting(roomId, channelId);
  }

  /**
   * DELETE /api/rooms/:id/channels/:channelId/meetings/:code/participants/:identity
   * Chỉ Chủ phòng hoặc Admin mới được phép đuổi người dùng ra khỏi cuộc họp
   */
  @Delete(":code/participants/:identity")
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard, RoomRoleGuard)
  async removeParticipant(
    @Param("code") meetingCode: string,
    @Param("identity") participantIdentity: string,
  ) {
    await this.meetingsService.removeParticipant(
      meetingCode,
      participantIdentity,
    );
  }

  /**
   * POST /api/rooms/:id/channels/:channelId/meetings/end
   * Luồng: Chỉ Chủ phòng hoặc Admin mới được phép kết thúc cuộc họp của kênh đó
   */
  @Post("end")
  @HttpCode(HttpStatus.NO_CONTENT) // Trả về 204 không kèm body khi thành công
  @Roles("owner", "admin")
  @UseGuards(SupabaseGuard, RoomRoleGuard)
  async endMeeting(
    @Param("id") roomId: string,
    @Param("channelId") channelId: string,
  ) {
    await this.meetingsService.endMeeting(roomId, channelId);
  }
}
