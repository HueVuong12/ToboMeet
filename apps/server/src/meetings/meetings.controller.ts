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
  Patch,
} from "@nestjs/common";
import { MeetingsService } from "./meetings.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { Roles } from "../core/decorators/roles.decorator";
import { JoinMeetingDto } from "./dtos/join-meeting.dto";
import { ChannelRoleGuard } from "../core/guards/channel-role.guard";
import { MeetingInviteService } from "./meeting-invite.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

// Sử dụng khi cần check quyền trong phòng (RoomRoleGuard), bắt buộc phải đem theo roomId và channelId
@Controller("rooms/:id/channels/:channelId/meetings")
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  /**
   * POST /api/rooms/:id/channels/:channelId/meetings/join
   * Mọi thành viên hợp lệ trong phòng đều có quyền gọi để Lấy Token (Join/Create)
   */
  @Post("join")
  @Roles("owner", "admin", "member")
  @UseGuards(SupabaseGuard, ChannelRoleGuard)
  async joinOrCreateMeeting(
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
      body.deviceId,
      body.displayName,
      body.forceSwitch,
    );
  }

  /**
   * GET /api/rooms/:id/channels/:channelId/meetings/devices/:deviceId
   * Kiểm tra trạng thái tham gia của thiết bị
   */
  @Get("devices/:deviceId")
  @UseGuards(SupabaseGuard)
  async getDeviceStatus(
    @Param("id") roomId: string,
    @Param("channelId") channelId: string,
    @Param("deviceId") deviceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.meetingsService.getDeviceStatus(
      roomId,
      channelId,
      userId,
      deviceId,
    );
  }

  /**
   * PUT /api/rooms/:id/channels/:channelId/meetings/:code/chat-status
   * Bật/tắt tính năng chat trong cuộc họp (Chỉ Chủ phòng hoặc Admin trong kênh)
   */
  @Put(":code/chat-status")
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard, ChannelRoleGuard)
  async toggleChat(
    @Param("code") meetingCode: string,
    @Body() body: { isChatEnabled: boolean },
  ) {
    await this.meetingsService.toggleRoomChat(meetingCode, body.isChatEnabled);
  }

  /**
   * PATCH /api/rooms/:id/channels/:channelId/meetings/:code/waiting-room-status
   * Bật/tắt tính năng phòng chờ
   */
  @Patch(":code/waiting-room-status")
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard, ChannelRoleGuard)
  async toggleWaitingRoom(
    @Param("code") meetingCode: string,
    @Body() body: { isWaitingRoomEnabled: boolean },
  ) {
    await this.meetingsService.toggleWaitingRoom(
      meetingCode,
      body.isWaitingRoomEnabled,
    );
  }

  /**
   * PATCH /api/rooms/:id/channels/:channelId/meetings/:code/participants/:identity/approve
   * Phê duyệt người dùng từ phòng chờ vào cuộc họp chính
   */
  @Patch(":code/participants/:identity/approve")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard)
  async approveParticipant(
    @Req() req: AuthenticatedRequest,
    @Param("code") meetingCode: string,
    @Param("identity") participantIdentity: string, // người đang chờ được phê duyệt
  ) {
    const requesterId = req.user.id; // người duyệt
    await this.meetingsService.approveParticipant(
      requesterId,
      meetingCode,
      participantIdentity,
    );
  }

  /**
   * PATCH /api/rooms/:id/channels/:channelId/meetings/:code/approval-permission
   * Thay đổi thiết lập ai được phép duyệt vào phòng
   */
  @Patch(":code/approval-permission")
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard, ChannelRoleGuard)
  async updateApprovalPermission(
    @Param("code") meetingCode: string,
    @Body()
    body: { permission: "admin_only" | "member_and_admin" | "everyone" },
  ) {
    await this.meetingsService.updateApprovalPermission(
      meetingCode,
      body.permission,
    );
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
  @UseGuards(SupabaseGuard, ChannelRoleGuard)
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
   * PUT /api/rooms/:id/channels/:channelId/meetings/:code/participants/:identity/mute
   * Tắt Mic / Camera của người dùng (Chỉ Admin/Owner)
   */
  @Put(":code/participants/:identity/mute")
  @Roles("owner", "admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SupabaseGuard, ChannelRoleGuard)
  async muteParticipant(
    @Param("code") meetingCode: string,
    @Param("identity") participantIdentity: string,
    @Body() body: { trackType: "audio" | "video" },
  ) {
    await this.meetingsService.muteParticipantTrack(
      meetingCode,
      participantIdentity,
      body.trackType,
    );
  }
}

@Controller("meetings") // Public meeting API, không cần check quyền
export class GlobalMeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly meetingInviteService: MeetingInviteService,
  ) {}

  /**
   * POST /api/meetings/join-by-code
   * Khách từ bên ngoài gửi meetingCode lên để xin vào phòng
   */
  @Post("join-by-code")
  @UseGuards(SupabaseGuard)
  async joinMeetingByCode(
    @Body()
    body: { meetingCode: string; deviceId: string; displayName?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;

    return this.meetingsService.joinMeetingByCode(
      body.meetingCode,
      userId,
      body.deviceId,
      body.displayName,
    );
  }

  /**
   * GET /api/meetings/:meetingCode/member-status
   * Kiểm tra trạng thái thành viên trong phòng của người dùng không lộ roomId
   * Chỉ trả về roomId khi là thành viên trong phòng (dùng điều hướng)
   */
  @Get(":meetingCode/member-status")
  @UseGuards(SupabaseGuard)
  async getMemberStatus(
    @Param("meetingCode") meetingCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;

    return this.meetingsService.getMemberStatus(meetingCode, userId);
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

  /**
   * POST /api/meetings/sessions/:sessionId/invite
   * Gửi lời mời tham gia cuộc họp
   */
  @Post(":meetingCode/invite")
  @UseGuards(SupabaseGuard)
  async inviteToMeeting(
    @Param("meetingCode") meetingCode: string,
    @Body("inviteeId") inviteeId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const inviterId = req.user.id;
    return this.meetingInviteService.sendMeetingInvite(
      inviterId,
      inviteeId,
      meetingCode,
    );
  }

  /**
   * GET /api/meetings/sessions/:sessionId/exchange
   * Đổi sessionId lấy thông tin phòng để tham gia
   */
  @Get("sessions/:sessionId/exchange")
  @UseGuards(SupabaseGuard)
  async exchangeSession(
    @Param("sessionId") sessionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.meetingInviteService.exchangeSessionForCode(userId, sessionId);
  }
}
