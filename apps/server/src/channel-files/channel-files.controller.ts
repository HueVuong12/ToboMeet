import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { ChannelFilesService } from "./channel-files.service";
import {
  SignedUrlRequestDto,
  CreateFileMetaDto,
  RenameFileDto,
} from "./dto/channel-files.dto";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller("channel-files")
@UseGuards(SupabaseGuard)
export class ChannelFilesController {
  constructor(private readonly filesService: ChannelFilesService) {}

  @Post("signed-url")
  async createSignedUploadUrl(
    @Body() dto: SignedUrlRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.filesService.createSignedUploadUrl(
      userId,
      dto.roomId,
      dto.channelId,
      dto.fileName,
    );
  }

  @Post()
  async saveFileMeta(
    @Body() dto: CreateFileMetaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.filesService.saveFileMeta(userId, dto);
  }

  @Get()
  async getChannelFiles(
    @Query("roomId") roomId: string,
    @Query("channelId") channelId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!roomId || !channelId) {
      throw new BadRequestException("roomId và channelId là bắt buộc");
    }
    const userId = req.user.id;
    return this.filesService.getChannelFiles(userId, roomId, channelId);
  }

  @Patch(":id/rename")
  async renameFile(
    @Param("id") fileId: string,
    @Body() dto: RenameFileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!dto.newName || !dto.newName.trim()) {
      throw new BadRequestException("Tên mới không được để trống");
    }
    const userId = req.user.id;
    return this.filesService.renameFile(userId, fileId, dto.newName);
  }

  @Delete(":id")
  async deleteFile(
    @Param("id") fileId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.filesService.deleteFile(userId, fileId);
  }

  @Get(":id/download-url")
  async getDownloadUrl(
    @Param("id") fileId: string,
    @Req() req: AuthenticatedRequest,
    @Query("download") download?: string,
  ) {
    const userId = req.user.id;
    const isDownload = download === "true";
    return this.filesService.getDownloadUrl(userId, fileId, isDownload);
  }
}
