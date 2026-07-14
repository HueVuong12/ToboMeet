import {
  Controller,
  Post,
  BadRequestException,
  UseGuards,
  Body,
} from "@nestjs/common";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
@UseGuards(SupabaseGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("report-evidence/signed-url")
  async createSignedUploadUrl(
    @Body() body: { fileName: string; mimeType: string }
  ) {
    if (!body || !body.fileName || !body.mimeType) {
      throw new BadRequestException("fileName và mimeType là bắt buộc");
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(body.mimeType.toLowerCase())) {
      throw new BadRequestException(
        "Chỉ chấp nhận các định dạng ảnh: JPG, JPEG, PNG, WEBP"
      );
    }

    return this.uploadsService.createSignedUploadUrl(body.fileName);
  }
}
