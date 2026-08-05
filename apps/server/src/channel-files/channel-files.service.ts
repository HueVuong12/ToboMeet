import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as path from "path";
import * as crypto from "crypto";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { ChannelFile, ChannelFileDocument } from "./schemas/channel-file.schema";
import { SupabaseService } from "../supabase/supabase.service";
import { RoomsGateway } from "../rooms/rooms.gateway";
import { CreateFileMetaDto } from "./dto/channel-files.dto";

@Injectable()
export class ChannelFilesService {
  private readonly bucketName = "channel-files";

  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ChannelFile.name)
    private readonly fileModel: Model<ChannelFileDocument>,
    private readonly supabaseService: SupabaseService,
    private readonly roomsGateway: RoomsGateway,
  ) {}

  private async ensureBucketExists() {
    try {
      const { data: buckets, error: listError } =
        await this.supabaseService.admin.storage.listBuckets();
      if (listError) throw listError;
      const exists = buckets.some((b) => b.name === this.bucketName);
      if (!exists) {
        const { error: createError } =
          await this.supabaseService.admin.storage.createBucket(
            this.bucketName,
            {
              public: true,
              fileSizeLimit: 50 * 1024 * 1024, // 50MB
            },
          );
        if (createError) throw createError;
      }
    } catch (err) {
      console.error(`Failed to ensure bucket "${this.bucketName}" exists:`, err);
    }
  }

  /**
   * Kiểm tra user có thuộc room & channel (bao gồm Private Channel check)
   */
  private async assertChannelAccess(
    userId: string,
    roomId: string,
    channelId: string,
  ): Promise<RoomDocument> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      isDeleted: { $ne: true },
    });
    if (!room) {
      throw new NotFoundException("Phòng không tồn tại");
    }

    // Check room membership
    const isOwner = room.ownerId === userId;
    const roomMember = room.members?.find(
      (m) =>
        m.userId === userId &&
        m.status !== "remove" &&
        m.status !== "left",
    );

    if (!isOwner && !roomMember) {
      throw new ForbiddenException({
        success: false,
        message: "Bạn không phải là thành viên của phòng này.",
      });
    }

    // Check channel existence
    const channel = room.channels?.find(
      (c) => c._id?.toString() === channelId,
    );
    if (!channel) {
      throw new NotFoundException("Kênh không tồn tại");
    }

    // Private channel check
    if (channel.isPrivate && !isOwner) {
      const isChannelMember = channel.members?.some(
        (m) => m.userId === userId,
      );
      if (!isChannelMember) {
        throw new ForbiddenException({
          success: false,
          message: "Bạn không có quyền truy cập kênh riêng tư này.",
        });
      }
    }

    // Check if left public channel
    if (!channel.isPrivate && channel.leftMemberIds?.includes(userId)) {
      throw new ForbiddenException({
        success: false,
        message: "Bạn đã rời khỏi kênh này.",
      });
    }

    return room;
  }

  /**
   * Kiểm tra quyền quản lý file (Owner hoặc Admin/Phó nhóm)
   */
  private assertCanManageFiles(room: RoomDocument, userId: string): void {
    if (room.ownerId === userId) return;

    const member = room.members?.find(
      (m) =>
        m.userId === userId &&
        m.status !== "remove" &&
        m.status !== "left",
    );

    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new ForbiddenException({
        success: false,
        message: "You do not have permission to upload files.",
      });
    }
  }

  /**
   * Tạo Signed Upload URL (Owner / Admin)
   */
  async createSignedUploadUrl(
    userId: string,
    roomId: string,
    channelId: string,
    originalFileName: string,
  ) {
    const room = await this.assertChannelAccess(userId, roomId, channelId);
    this.assertCanManageFiles(room, userId);

    await this.ensureBucketExists();

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    const ext = path.extname(originalFileName).toLowerCase();
    const uniqueFileName = `${uuid}-${timestamp}${ext}`;
    const filePath = `${roomId}/${channelId}/${year}/${month}/${uniqueFileName}`;

    const { data, error } = await this.supabaseService.admin.storage
      .from(this.bucketName)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw new BadRequestException(
        `Không thể tạo signed upload URL: ${error.message}`,
      );
    }

    const { data: publicUrlData } = this.supabaseService.admin.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return {
      signedUrl: data.signedUrl,
      publicUrl: publicUrlData.publicUrl,
      storagePath: filePath,
    };
  }

  /**
   * Lưu Metadata của File sau khi upload thành công (Owner / Admin)
   */
  async saveFileMeta(userId: string, dto: CreateFileMetaDto) {
    const room = await this.assertChannelAccess(
      userId,
      dto.roomId,
      dto.channelId,
    );
    this.assertCanManageFiles(room, userId);

    // Fetch user info for cache
    const user = await this.userModel
      .findOne({ supabaseId: userId })
      .lean()
      .exec();

    const newFile = await this.fileModel.create({
      roomId: dto.roomId,
      channelId: dto.channelId,
      uploadedBy: userId,
      uploadedByName: user?.displayName || user?.email || "Thành viên",
      fileName: dto.fileName,
      storagePath: dto.storagePath,
      publicUrl: dto.publicUrl,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      isDeleted: false,
    });

    const result = newFile.toObject();

    // Emit Realtime socket event to all room members
    this.roomsGateway.notifyFileUploaded(dto.roomId, dto.channelId, result);

    return result;
  }

  /**
   * Lấy danh sách file trong kênh (Mọi thành viên trong Kênh)
   */
  async getChannelFiles(userId: string, roomId: string, channelId: string) {
    await this.assertChannelAccess(userId, roomId, channelId);

    return this.fileModel
      .find({
        roomId,
        channelId,
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Đổi tên file (Owner / Admin)
   */
  async renameFile(userId: string, fileId: string, newName: string) {
    const file = await this.fileModel.findById(fileId);
    if (!file || file.isDeleted) {
      throw new NotFoundException("Tệp không tồn tại");
    }

    const room = await this.assertChannelAccess(
      userId,
      file.roomId,
      file.channelId,
    );
    this.assertCanManageFiles(room, userId);

    file.fileName = newName.trim();
    await file.save();

    // Socket notification
    this.roomsGateway.notifyFileRenamed(
      file.roomId,
      file.channelId,
      fileId,
      file.fileName,
    );

    return file.toObject();
  }

  /**
   * Xóa file (Owner / Admin)
   */
  async deleteFile(userId: string, fileId: string) {
    const file = await this.fileModel.findById(fileId);
    if (!file || file.isDeleted) {
      throw new NotFoundException("Tệp không tồn tại");
    }

    const room = await this.assertChannelAccess(
      userId,
      file.roomId,
      file.channelId,
    );
    this.assertCanManageFiles(room, userId);

    file.isDeleted = true;
    await file.save();

    // Remove from Supabase storage (soft delete in db, hard delete in storage)
    try {
      await this.supabaseService.admin.storage
        .from(this.bucketName)
        .remove([file.storagePath]);
    } catch (err) {
      console.error(`Failed to remove file from Supabase storage:`, err);
    }

    // Socket notification
    this.roomsGateway.notifyFileDeleted(file.roomId, file.channelId, fileId);

    return { success: true };
  }

  /**
   * Sinh Signed Download URL hết hạn trong 60 giây (Thành viên có quyền xem kênh)
   */
  async getDownloadUrl(userId: string, fileId: string, download?: boolean) {
    const file = await this.fileModel.findById(fileId);
    if (!file || file.isDeleted) {
      throw new NotFoundException("Tệp không tồn tại");
    }

    await this.assertChannelAccess(userId, file.roomId, file.channelId);

    const options = download ? { download: file.fileName } : undefined;

    const { data, error } = await this.supabaseService.admin.storage
      .from(this.bucketName)
      .createSignedUrl(file.storagePath, 60, options);

    if (error || !data) {
      throw new BadRequestException("Không thể tạo liên kết tải xuống.");
    }

    return { downloadUrl: data.signedUrl, fileName: file.fileName };
  }
}
