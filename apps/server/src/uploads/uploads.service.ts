import { Injectable, OnModuleInit, BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly uploadDir = path.join(__dirname, "..", "..", "uploads", "reports");

  constructor(private readonly supabaseService: SupabaseService) {}

  onModuleInit() {
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getUploadDirectory(): string {
    return this.uploadDir;
  }

  private async ensureBucketExists(bucketName: string) {
    try {
      const { data: buckets, error: listError } = await this.supabaseService.admin.storage.listBuckets();
      if (listError) {
        throw listError;
      }

      const exists = buckets.some((b) => b.name === bucketName);
      if (!exists) {
        const { error: createError } = await this.supabaseService.admin.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
        });
        if (createError) {
          throw createError;
        }
      }
    } catch (err) {
      console.error(`Failed to ensure bucket "${bucketName}" exists:`, err);
    }
  }
  async createSignedUploadUrl(originalFileName: string) {
    const bucketName = "report-evidence";

    // Đảm bảo bucket report-evidence tồn tại và công khai
    await this.ensureBucketExists(bucketName);

    // Tạo tên file duy nhất (UUID + timestamp) và tổ chức thư mục theo report-evidence/YYYY/MM/
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    const ext = path.extname(originalFileName).toLowerCase();
    const uniqueFileName = `${uuid}-${timestamp}${ext}`;
    const filePath = `${year}/${month}/${uniqueFileName}`;

    // Tạo Signed Upload URL
    const { data, error } = await this.supabaseService.admin.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw new BadRequestException(`Không thể tạo signed upload URL: ${error.message}`);
    }

    // Lấy Public URL của ảnh tương lai
    const { data: publicUrlData } = this.supabaseService.admin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      signedUrl: data.signedUrl,
      url: publicUrlData.publicUrl,
      fileName: uniqueFileName,
    };
  }
}
