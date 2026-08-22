import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
  Get,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { BreakoutRoomsService } from "./breakout-rooms.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { StartBreakoutSessionDto } from "./dtos/create-breakout-room.dto";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller("meetings")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BreakoutRoomsController {
  constructor(private readonly breakoutRoomsService: BreakoutRoomsService) {}

  /**
   * POST /api/meetings/:code/breakout/start
   * HOST: Khởi tạo phiên Breakout (Chỉ Owner/Admin mới được phép)
   */
  @Post(":code/breakout/start")
  @UseGuards(SupabaseGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async startBreakout(
    @Param("code") meetingCode: string,
    @Body() body: StartBreakoutSessionDto,
  ) {
    await this.breakoutRoomsService.startBreakoutSession(
      meetingCode,
      body.rooms,
      body.durationMinutes,
    );
  }

  /**
   * POST /api/rooms/:id/channels/:channelId/meetings/:code/breakout/end
   * HOST: Kết thúc phiên Breakout sớm (Chỉ Owner/Admin)
   */
  @Post(":code/breakout/end")
  //   @Roles("owner", "admin")
  @UseGuards(SupabaseGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async endBreakout(@Param("code") meetingCode: string) {
    await this.breakoutRoomsService.endBreakoutSession(meetingCode);
  }

  /**
   * POST /api/meetings/:code/breakout/join
   * PARTICIPANT: Xin Token để nhảy vào phòng Breakout
   * (Chỉ cần đăng nhập, service sẽ tự check xem user có ở Main Room không)
   */
  @Post(":code/breakout/join")
  @UseGuards(SupabaseGuard)
  @HttpCode(HttpStatus.OK)
  async joinBreakout(
    @Req() req: AuthenticatedRequest,
    @Param("code") meetingCode: string,
    @Body() body: { breakoutRoomId: string; deviceId: string },
  ) {
    return this.breakoutRoomsService.joinBreakoutRoom(
      meetingCode,
      body.breakoutRoomId,
      req.user.id,
      body.deviceId,
    );
  }

  /**
   * POST /api/breakout/:fullBreakoutRoomName/return
   * PARTICIPANT: Quay về phòng chính (Đọc Metadata từ Breakout Room)
   */
  @Post("breakout/:fullBreakoutRoomName/return")
  @UseGuards(SupabaseGuard)
  @HttpCode(HttpStatus.OK)
  async returnToMainRoom(
    @Req() req: AuthenticatedRequest,
    @Param("fullBreakoutRoomName") fullBreakoutRoomName: string,
    @Body() body: { deviceId: string },
  ) {
    return this.breakoutRoomsService.returnToMainRoom(
      fullBreakoutRoomName,
      req.user.id,
      body.deviceId,
    );
  }

  /**
   * GET /api/meetings/:code/breakout/counts
   * PARTICIPANT: Lấy số lượng người đang trong các nhóm thảo luận
   */
  @Get(":code/breakout/counts")
  @UseGuards(SupabaseGuard)
  async getBreakoutCounts(@Param("code") meetingCode: string) {
    return this.breakoutRoomsService.getBreakoutRoomsParticipantCount(
      meetingCode,
    );
  }
}
