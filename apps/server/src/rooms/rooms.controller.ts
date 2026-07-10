import { Request } from "express";
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Delete,
} from "@nestjs/common";
import { RoomsService } from "./rooms.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { RoomRoleGuard } from "../core/guards/room-role.guard";
import { Roles } from "../core/decorators/roles.decorator";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller("rooms")
@UseGuards(SupabaseGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * POST /api/rooms — Tạo phòng mới
   */
  @Post()
  async createRoom(@Body() dto: CreateRoomDto, @Req() req: AuthenticatedRequest) {
    console.log(`[RoomsController] Yêu cầu tạo phòng từ userId: ${req.user?.id}`, dto);
    if (!dto.name || !dto.type) {
      throw new BadRequestException("Tên phòng và loại phòng là bắt buộc");
    }

    if (!["meeting", "classroom"].includes(dto.type)) {
      throw new BadRequestException(
        "Loại phòng phải là 'meeting' hoặc 'classroom'",
      );
    }

    const userId = req.user.id;
    try {
      const result = await this.roomsService.createRoom(userId, dto);
      console.log(`[RoomsController] Tạo phòng THÀNH CÔNG, code: ${result.code}`);
      return result;
    } catch (err) {
      console.error(`[RoomsController] Tạo phòng THẤT BẠI:`, err);
      throw err;
    }
  }

  /**
   * GET /api/rooms/my — Lấy danh sách phòng của user hiện tại
   */
  @Get("my")
  async getMyRooms(@Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.roomsService.getMyRooms(userId);
  }

  /**
   * GET /api/rooms/:id/members — Lấy toàn bộ danh sách thành viên trong phòng
   */
  @Get(":id/members")
  async getRoomMembers(@Param("id") roomId: string) {
    return this.roomsService.getRoomMembers(roomId);
  }

  /**
   * DELETE /api/rooms/:id/members/:userId — Xóa thành viên khỏi phòng (chỉ chủ phòng)
   */
  @Delete(":id/members/:userId")
  @Roles("owner")
  @UseGuards(SupabaseGuard, RoomRoleGuard) // Chạy Guard check quyền trước
  async removeMember(
    @Param("id") roomId: string,
    @Param("userId") targetUserId: string,
  ) {
    return this.roomsService.removeMember(roomId, targetUserId);
  }

  /**
   * POST /api/rooms/join — Tham gia phòng bằng mã code
   */
  @Post("join")
  async joinRoom(@Body() dto: JoinRoomDto, @Req() req: AuthenticatedRequest) {
    if (!dto.code) {
      throw new BadRequestException("Mã phòng là bắt buộc");
    }

    const userId = req.user.id;
    return this.roomsService.joinRoom(userId, dto.code);
  }

  /**
   * POST /api/rooms/:id/channels — Thêm kênh mới (chỉ chủ phòng)
   */
  @Post(":id/channels")
  @Roles("owner", "admin")
  @UseGuards(SupabaseGuard, RoomRoleGuard) // Chạy Guard check quyền trước
  async addChannel(
    @Param("id") roomId: string,
    @Body() dto: CreateChannelDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException("Tên kênh không được để trống");
    }
    if (dto.name.trim().length > 30) {
      throw new BadRequestException("Tên kênh không được vượt quá 30 ký tự");
    }
    const userId = req.user.id;
    return this.roomsService.addChannel(userId, roomId, dto.name);
  }

  /**
   * POST /api/rooms/:id/members/invite — Thêm thành viên bằng email hoặc userId
   */
  @Post(":id/members/invite")
  async addMemberByEmailOrId(
    @Param("id") roomId: string,
    @Body("email") email: string | undefined,
    @Body("targetUserId") targetUserId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!email && !targetUserId) {
      throw new BadRequestException("Email hoặc ID người dùng là bắt buộc");
    }
    const userId = req.user.id;
    return this.roomsService.addMemberByEmailOrId(userId, roomId, {
      email,
      targetUserId,
    });
  }

  /**
   * POST /api/rooms/:id/leave — Rời khỏi phòng
   */
  @Post(":id/leave")
  @HttpCode(HttpStatus.OK)
  async leaveRoom(
    @Param("id") roomId: string,
    @Body("newOwnerId") newOwnerId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.roomsService.leaveRoom(roomId, userId, newOwnerId);
  }

  /**
   * GET /api/rooms/code/:code — Lấy thông tin sơ bộ của phòng bằng mã code
   */
  @Get("code/:code")
  async getRoomByCode(@Param("code") code: string) {
    return this.roomsService.getRoomByCode(code);
  }

  /**
   * GET /api/rooms/:id — Lấy chi tiết phòng
   */
  @Get(":id")
  async getRoomById(@Param("id") id: string) {
    return this.roomsService.getRoomById(id);
  }

  /**
   * DELETE /api/rooms/:id — Giải tán phòng họp (chủ phòng thực hiện)
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async disbandRoom(@Param("id") roomId: string, @Req() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.roomsService.disbandRoom(roomId, userId);
  }
}
