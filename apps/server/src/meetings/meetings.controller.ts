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
  Put,
} from "@nestjs/common";
import { MeetingsService } from "./meetings.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { RoomRoleGuard } from "../core/guards/room-role.guard";
import { Roles } from "../core/decorators/roles.decorator";
import { JoinMeetingDto } from "./dtos/join-meeting.dto";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

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
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.meetingsService.joinOrCreateMeeting(
      roomId,
      channelId,
      userId,
      body.displayName,
      body.forceSwitch,
    );
  }

  @Put(":code/chat-status")
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard, RoomRoleGuard)
  async toggleChat(
    @Param("code") meetingCode: string,
    @Body() body: { isChatEnabled: boolean },
  ) {
    await this.meetingsService.toggleRoomChat(meetingCode, body.isChatEnabled);
  }

  /**
   * GET /api/rooms/:id/channels/:channelId/meetings/active
   * Lấy trạng thái cuộc họp đang diễn ra trong kênh
   */
  @Get("active")
  @UseGuards(SupabaseGuard)
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
}

@Controller("meetings") // Public meeting API
export class GlobalMeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * POST /api/meetings/join-by-code
   * Khách từ bên ngoài gửi meetingCode lên để xin vào phòng
   */
  @Post("join-by-code")
  @UseGuards(SupabaseGuard)
  async joinMeetingByCode(
    @Body() body: { meetingCode: string; displayName?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;

    return this.meetingsService.joinMeetingByCode(
      body.meetingCode,
      userId,
      body.displayName,
    );
  }

  /**
   * POST /api/meetings/presigned
   * Xin presigned upload url để upload file lên chat của meeting
   */
  @Post("presigned")
  @UseGuards(SupabaseGuard)
  async getPresignedUrl(
    @Body() body: { fileName: string; meetingCode: string },
  ) {
    return this.meetingsService.generatePresignedUrl(
      body.fileName,
      body.meetingCode,
    );
  }
}
