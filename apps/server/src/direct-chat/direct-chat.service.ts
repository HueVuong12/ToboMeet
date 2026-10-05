import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as crypto from "crypto";
import * as path from "path";
import {
  DirectConversation,
  DirectConversationDocument,
} from "./schemas/direct-conversation.schema";
import {
  DirectMessage,
  DirectMessageDocument,
} from "./schemas/direct-message.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { SupabaseService } from "../supabase/supabase.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { GetChatUploadUrlDto } from "./dto/chat-actions.dto";
import { AppGateway } from "../core/gateways/app.gateway";

@Injectable()
export class DirectChatService {
  private readonly verifiedBuckets = new Set<string>();

  constructor(
    @InjectModel(DirectConversation.name)
    private conversationModel: Model<DirectConversationDocument>,
    @InjectModel(DirectMessage.name)
    private messageModel: Model<DirectMessageDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private supabaseService: SupabaseService,
    private appGateway: AppGateway,
  ) {}

  private async ensureBucketExists(bucketName: string) {
    if (this.verifiedBuckets.has(bucketName)) {
      return;
    }
    try {
      const { data: buckets, error: listError } =
        await this.supabaseService.admin.storage.listBuckets();
      if (listError) {
        throw listError;
      }

      const exists = buckets?.some((b) => b.name === bucketName);
      if (!exists) {
        const { error: createError } =
          await this.supabaseService.admin.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 50 * 1024 * 1024, // 50MB cho video
          });
        if (createError) {
          throw createError;
        }
      }
      this.verifiedBuckets.add(bucketName);
    } catch (err) {
      console.error(`Failed to ensure chat bucket "${bucketName}" exists:`, err);
    }
  }

  /**
   * Tạo mới hoặc lấy cuộc trò chuyện 1-1 giữa 2 người dùng
   */
  async getOrCreateConversation(currentUserId: string, recipientId: string) {
    if (!recipientId) {
      throw new BadRequestException("ID người nhận không hợp lệ");
    }
    if (currentUserId === recipientId) {
      throw new BadRequestException("Không thể tạo cuộc trò chuyện với chính mình");
    }

    const recipientUser = await this.userModel
      .findOne({ supabaseId: recipientId })
      .select("supabaseId displayName avatarUrl email status")
      .lean();

    if (!recipientUser) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    const participantIds = [currentUserId, recipientId].sort();

    let conversation = await this.conversationModel
      .findOne({ participantIds })
      .lean();

    if (!conversation) {
      const newDoc = await this.conversationModel.create({
        participantIds,
        lastMessageAt: new Date(),
        lastMessagePreview: "Cuộc trò chuyện mới",
        unreadCounts: {
          [currentUserId]: 0,
          [recipientId]: 0,
        },
      });
      conversation = newDoc.toObject();
    }

    return this.formatConversation(conversation, currentUserId, [recipientUser]);
  }

  /**
   * Lấy danh sách cuộc trò chuyện của người dùng hiện tại
   */
  async getConversations(currentUserId: string) {
    const rawConversations = await this.conversationModel
      .find({ participantIds: currentUserId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const allParticipantIds = new Set<string>();
    for (const c of rawConversations) {
      for (const pid of c.participantIds) {
        if (pid !== currentUserId) {
          allParticipantIds.add(pid);
        }
      }
    }

    const otherUsers = await this.userModel
      .find({ supabaseId: { $in: Array.from(allParticipantIds) } })
      .select("supabaseId displayName avatarUrl email status")
      .lean();

    return rawConversations.map((conv) =>
      this.formatConversation(conv, currentUserId, otherUsers),
    );
  }

  /**
   * Lấy chi tiết một cuộc trò chuyện
   */
  async getConversationById(conversationId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException("Mã cuộc trò chuyện không hợp lệ");
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .lean();

    if (!conversation) {
      throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
    }

    if (!conversation.participantIds.includes(currentUserId)) {
      throw new ForbiddenException("Bạn không có quyền truy cập cuộc trò chuyện này");
    }

    const otherIds = conversation.participantIds.filter((id) => id !== currentUserId);
    const otherUsers = await this.userModel
      .find({ supabaseId: { $in: otherIds } })
      .select("supabaseId displayName avatarUrl email status")
      .lean();

    return this.formatConversation(conversation, currentUserId, otherUsers);
  }

  /**
   * Lấy lịch sử tin nhắn có phân trang (cursor-based: before messageId)
   */
  async getMessages(
    conversationId: string,
    currentUserId: string,
    options: { before?: string; limit?: number } = {},
  ) {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException("Mã cuộc trò chuyện không hợp lệ");
    }

    const conversation = await this.conversationModel.findById(conversationId).lean();
    if (!conversation) {
      throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
    }

    if (!conversation.participantIds.includes(currentUserId)) {
      throw new ForbiddenException("Bạn không có quyền truy cập cuộc trò chuyện này");
    }

    const limit = Math.min(Math.max(options.limit || 30, 1), 50);
    const query: any = { conversationId: new Types.ObjectId(conversationId) };

    if (options.before && Types.ObjectId.isValid(options.before)) {
      query._id = { $lt: new Types.ObjectId(options.before) };
    }

    const rawMessages = await this.messageModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({
        path: "replyToId",
        select: "_id content senderId type attachments deletedAt",
      })
      .lean();

    const hasMore = rawMessages.length > limit;
    if (hasMore) {
      rawMessages.pop();
    }

    // Lấy thông tin người gửi
    const senderIds = Array.from(new Set(rawMessages.map((m) => m.senderId)));
    const senders = await this.userModel
      .find({ supabaseId: { $in: senderIds } })
      .select("supabaseId displayName avatarUrl email")
      .lean();

    const senderMap = new Map<string, any>(
      senders.map((s) => [s.supabaseId, s]),
    );

    // Format & đảo ngược danh sách để hiển thị từ cũ -> mới theo thứ tự thời gian
    const messages = rawMessages.reverse().map((msg) => ({
      ...msg,
      id: msg._id.toString(),
      sender: senderMap.get(msg.senderId) || {
        supabaseId: msg.senderId,
        displayName: "Người dùng",
        avatarUrl: null,
      },
    }));

    return {
      messages,
      hasMore,
      nextCursor: hasMore && messages.length > 0 ? messages[0].id : null,
    };
  }

  /**
   * Gửi tin nhắn mới
   */
  async sendMessage(
    conversationId: string,
    currentUserId: string,
    dto: SendMessageDto,
  ) {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException("Mã cuộc trò chuyện không hợp lệ");
    }

    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
    }

    if (!conversation.participantIds.includes(currentUserId)) {
      throw new ForbiddenException("Bạn không thể gửi tin nhắn vào cuộc trò chuyện này");
    }

    const trimmedContent = dto.content?.trim() || "";
    const hasAttachments = Boolean(dto.attachments && dto.attachments.length > 0);

    if (!trimmedContent && !hasAttachments) {
      throw new BadRequestException("Nội dung tin nhắn hoặc tệp đính kèm là bắt buộc");
    }

    let type = dto.type || "text";
    if (hasAttachments && type === "text") {
      type = dto.attachments![0].fileType || "file";
    }

    let replyToObjectId: Types.ObjectId | null = null;
    if (dto.replyToId) {
      if (Types.ObjectId.isValid(dto.replyToId)) {
        const replyMsg = await this.messageModel.findOne({
          _id: new Types.ObjectId(dto.replyToId),
          conversationId: new Types.ObjectId(conversationId),
        } as any);
        if (replyMsg) {
          replyToObjectId = replyMsg._id as Types.ObjectId;
        }
      }
    }

    const createdMsg: any = await this.messageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: currentUserId,
      type,
      content: trimmedContent,
      attachments: dto.attachments || [],
      replyToId: replyToObjectId,
      reactions: [],
      deletedAt: null,
    } as any);

    // Tạo preview tóm tắt cho conversation
    let previewText = trimmedContent;
    if (hasAttachments) {
      const firstAtt = dto.attachments![0];
      if (firstAtt.fileType === "image") {
        previewText = trimmedContent ? `📷 ${trimmedContent}` : "📷 [Hình ảnh]";
      } else if (firstAtt.fileType === "video") {
        previewText = trimmedContent ? `🎥 ${trimmedContent}` : "🎥 [Video]";
      } else {
        previewText = trimmedContent
          ? `📎 ${trimmedContent}`
          : `📎 [Tệp: ${firstAtt.fileName}]`;
      }
    }

    // Cập nhật conversation & tăng unread count cho người nhận
    const otherParticipantId = conversation.participantIds.find(
      (id) => id !== currentUserId,
    );

    const updateOps: any = {
      $set: {
        lastMessageAt: new Date(),
        lastMessagePreview: previewText,
      },
    };

    if (otherParticipantId) {
      updateOps.$inc = { [`unreadCounts.${otherParticipantId}`]: 1 };
    }

    await this.conversationModel.findByIdAndUpdate(conversationId, updateOps);

    // Lấy thông tin người gửi để populate
    const sender = await this.userModel
      .findOne({ supabaseId: currentUserId })
      .select("supabaseId displayName avatarUrl email")
      .lean();

    const populatedMsg: any = await this.messageModel
      .findById(createdMsg?._id)
      .populate({
        path: "replyToId",
        select: "_id content senderId type attachments deletedAt",
      })
      .lean();

    populatedMsg.id = populatedMsg._id.toString();
    populatedMsg.sender = sender || {
      supabaseId: currentUserId,
      displayName: "Người dùng",
      avatarUrl: null,
    };

    // Emit Socket realtime events
    try {
      if (this.appGateway?.server) {
        this.appGateway.server.to(`chat_${conversationId}`).emit("chat:new_message", populatedMsg);
        console.log(`[DirectChat] Emitted chat:new_message to chat_${conversationId}`);
        if (otherParticipantId) {
          this.appGateway.server.to(`user_${otherParticipantId}`).emit("chat:conversation_updated", {
            conversationId,
            previewText,
          });
          console.log(`[DirectChat] Emitted chat:conversation_updated to user_${otherParticipantId}`);
        }
      } else {
        console.warn("[DirectChat] appGateway.server is not initialized during sendMessage!");
      }
    } catch (socketErr) {
      console.error("[DirectChat] Socket emit error:", socketErr);
    }

    return populatedMsg;
  }

  /**
   * Đánh dấu cuộc trò chuyện đã đọc
   */
  async markAsRead(conversationId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException("Mã cuộc trò chuyện không hợp lệ");
    }

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCounts.${currentUserId}`]: 0 },
    });

    try {
      if (this.appGateway?.server) {
        this.appGateway.server.to(`chat_${conversationId}`).emit("chat:read_updated", {
          conversationId,
          readerId: currentUserId,
        });
      }
    } catch (socketErr) {
      console.error("[DirectChat] Socket emit read error:", socketErr);
    }

    return { success: true };
  }

  /**
   * Thả cảm xúc (reaction) vào tin nhắn
   */
  async reactMessage(messageId: string, currentUserId: string, emoji: string) {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException("Mã tin nhắn không hợp lệ");
    }
    if (!emoji || typeof emoji !== "string") {
      throw new BadRequestException("Emoji không hợp lệ");
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException("Không tìm thấy tin nhắn");
    }
    if (message.deletedAt) {
      throw new BadRequestException("Không thể tương tác với tin nhắn đã xóa");
    }

    // 1. Gỡ bỏ user khỏi tất cả các reaction hiện tại trên tin nhắn này
    const reactions = (message.reactions || []).map((r) => ({
      emoji: r.emoji,
      userIds: [...(r.userIds || [])],
    }));

    let wasSameEmoji = false;
    for (let i = reactions.length - 1; i >= 0; i--) {
      const r = reactions[i];
      const uIdx = r.userIds.indexOf(currentUserId);
      if (uIdx > -1) {
        if (r.emoji === emoji) {
          wasSameEmoji = true;
        }
        r.userIds.splice(uIdx, 1);
        if (r.userIds.length === 0) {
          reactions.splice(i, 1);
        }
      }
    }

    // 2. Nếu không phải click lại chính emoji đó (toggle-off), thêm user vào emoji mới
    if (!wasSameEmoji) {
      const targetIndex = reactions.findIndex((r) => r.emoji === emoji);
      if (targetIndex > -1) {
        reactions[targetIndex].userIds.push(currentUserId);
      } else {
        reactions.push({ emoji, userIds: [currentUserId] });
      }
    }

    // 3. Lọc bỏ hoàn toàn các emoji không còn ai thả
    const cleanReactions = reactions.filter((r) => r.userIds && r.userIds.length > 0);
    message.reactions = cleanReactions as any;
    await message.save();

    const conversationId = message.conversationId.toString();
    try {
      if (this.appGateway?.server) {
        this.appGateway.server.to(`chat_${conversationId}`).emit("chat:reaction_updated", {
          messageId,
          reactions: cleanReactions,
        });
      }
    } catch (socketErr) {
      console.error("[DirectChat] Socket emit reaction error:", socketErr);
    }

    return { messageId, reactions: cleanReactions };
  }

  /**
   * Thu hồi / Xóa tin nhắn (soft delete)
   */
  async deleteMessage(messageId: string, currentUserId: string) {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException("Mã tin nhắn không hợp lệ");
    }

    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new NotFoundException("Không tìm thấy tin nhắn");
    }

    if (message.senderId !== currentUserId) {
      throw new ForbiddenException("Chỉ người gửi mới có quyền thu hồi tin nhắn này");
    }

    message.deletedAt = new Date();
    message.content = "Tin nhắn đã bị thu hồi";
    message.attachments = [];
    await message.save();

    const conversationId = message.conversationId.toString();
    try {
      if (this.appGateway?.server) {
        this.appGateway.server.to(`chat_${conversationId}`).emit("chat:message_deleted", {
          messageId,
          conversationId,
        });
        console.log(`[DirectChat] Emitted chat:message_deleted to chat_${conversationId} for message ${messageId}`);
      } else {
        console.warn("[DirectChat] appGateway.server is not initialized during deleteMessage!");
      }
    } catch (socketErr) {
      console.error("[DirectChat] Socket emit delete error:", socketErr);
    }

    return { messageId, deletedAt: message.deletedAt };
  }

  /**
   * Tạo Signed Upload URL cho ảnh, video hoặc tệp tài liệu trong chat
   */
  async getChatUploadUrl(
    conversationId: string,
    currentUserId: string,
    dto: GetChatUploadUrlDto,
  ) {
    if (!Types.ObjectId.isValid(conversationId)) {
      throw new BadRequestException("Mã cuộc trò chuyện không hợp lệ");
    }

    const conversation = await this.conversationModel.findById(conversationId).lean();
    if (!conversation || !conversation.participantIds.includes(currentUserId)) {
      throw new ForbiddenException("Bạn không thuộc cuộc trò chuyện này");
    }

    const bucketName = "chat-attachments";
    await this.ensureBucketExists(bucketName);

    // Giới hạn dung lượng: Video <= 50MB, File/Image <= 10MB
    const isVideo = dto.mimeType?.startsWith("video/") || false;
    const maxLimit = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    if (dto.fileSize > maxLimit) {
      const limitMb = isVideo ? "50MB" : "10MB";
      throw new BadRequestException(`Dung lượng tệp vượt quá giới hạn cho phép (${limitMb})`);
    }

    const ext = path.extname(dto.fileName).toLowerCase() || "";
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const filePath = `conversations/${conversationId}/${uniqueName}`;

    const { data, error } = await this.supabaseService.admin.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (error) {
      throw new BadRequestException(`Không thể tạo signed upload URL: ${error.message}`);
    }

    const { data: publicUrlData } = this.supabaseService.admin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    let fileType: "image" | "video" | "file" = "file";
    if (dto.mimeType?.startsWith("image/")) {
      fileType = "image";
    } else if (dto.mimeType?.startsWith("video/")) {
      fileType = "video";
    }

    return {
      signedUrl: data.signedUrl,
      url: publicUrlData.publicUrl,
      fileName: dto.fileName,
      fileType,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
    };
  }

  /**
   * Helper format dữ liệu conversation trả về cho client
   */
  private formatConversation(
    conv: any,
    currentUserId: string,
    otherUsers: any[],
  ) {
    const recipientId = conv.participantIds.find((id: string) => id !== currentUserId);
    const recipient = otherUsers.find((u) => u.supabaseId === recipientId) || {
      supabaseId: recipientId,
      displayName: "Người dùng",
      avatarUrl: null,
      email: "",
      status: "ACTIVE",
    };

    let unreadCount = 0;
    if (conv.unreadCounts) {
      if (conv.unreadCounts instanceof Map) {
        unreadCount = conv.unreadCounts.get(currentUserId) || 0;
      } else {
        unreadCount = (conv.unreadCounts as any)[currentUserId] || 0;
      }
    }

    return {
      id: conv._id.toString(),
      participantIds: conv.participantIds,
      recipient,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: conv.lastMessagePreview,
      unreadCount,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  }
}
