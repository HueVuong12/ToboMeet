import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AppGateway } from "../core/gateways/app.gateway";
import {
  Notification,
  NotificationDocument,
} from "./schemas/notification.schema";
import { GetNotificationsDto } from "./dto/get-notifications.dto";
import { NotificationResponse, PageResponse } from "@tobomeet/shared/types";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class NotificationsService {
  constructor(
    private appGateway: AppGateway,

    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Helper cập nhật trạng thái có thông báo chưa đọc cho User(s).
   * Chạy bất đồng bộ (không block luồng chính).
   */
  async toggleUnreadStatus(userIds: string | string[], hasUnread: boolean) {
    try {
      const ids = Array.isArray(userIds) ? userIds : [userIds];
      if (ids.length === 0) return;

      await this.userModel.updateMany(
        { supabaseId: { $in: ids } },
        { $set: { hasUnreadNotifications: hasUnread } },
      );
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái Unread Notification:", error);
    }
  }

  /**
   * Lấy danh sách thông báo của người dùng với bộ lọc tự code
   */
  async getUserNotifications(
    userId: string,
    query: GetNotificationsDto,
  ): Promise<PageResponse<NotificationResponse>> {
    const { page = 1, limit = 20, type, isRead } = query;
    const skip = (page - 1) * limit;

    // Build filter an toàn: Bắt buộc filter phải chứa userId của người đang login
    const filter: Record<string, any> = { userId };

    if (type) {
      filter.type = type;
    }

    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }

    // Chạy song song query
    const [total, notifications] = await Promise.all([
      this.notificationModel.countDocuments(filter),
      this.notificationModel
        .find(filter)
        .sort({ updatedAt: -1 }) // Cố định mới nhất lên đầu
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    this.toggleUnreadStatus(userId, false);

    // Map dữ liệu
    const items: NotificationResponse[] = notifications.map((doc: any) => ({
      _id: doc._id.toString(),
      userId: doc.userId,
      type: doc.type,
      metadata: doc.metadata,
      isRead: doc.isRead,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
    };
  }

  // Thông báo cho người bị kick
  @OnEvent("notification.kicked", { async: true })
  async handleUserKicked(payload: {
    userId: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      const newNotif = await this.notificationModel.create({
        userId: payload.userId,
        type: "KICKED",
        metadata: payload.metadata,
        isRead: false,
        isNotified: false,
        canPopup: true,
      });

      this.toggleUnreadStatus(payload.userId, true);

      this.appGateway.server
        .to(`user_${payload.userId}`)
        .emit("receive_notifications", [newNotif]);
    } catch (error) {
      console.error(error);
    }
  }

  // Thông báo cho tất cả thành viên khi giải tán nhóm
  @OnEvent("notification.room_disbanded", { async: true })
  async handleRoomDisbanded(payload: {
    userIds: string[];
    metadata: Record<string, unknown>;
  }) {
    try {
      if (!payload.userIds?.length) return;

      const notificationsToInsert = payload.userIds.map((userId) => ({
        userId,
        type: "ROOM_DISBANDED",
        metadata: payload.metadata,
        isRead: false,
        isNotified: false,
        canPopup: true,
      }));

      const insertedNotifs = await this.notificationModel.insertMany(
        notificationsToInsert,
      );

      this.toggleUnreadStatus(payload.userIds, true);

      insertedNotifs.forEach((notif) => {
        this.appGateway.server
          .to(`user_${notif.userId}`)
          .emit("receive_notifications", [notif]);
      });
    } catch (error) {
      console.error(error);
    }
  }

  // Thông báo cho người bị xoá khỏi cuộc họp
  @OnEvent("notification.participant_removed", { async: true })
  async handleParticipantRemoved(payload: {
    userId: string;
    metadata: Record<string, unknown>;
  }) {
    const newNotif = {
      userId: payload.userId,
      type: "PARTICIPANT_REMOVED",
      metadata: payload.metadata,
    };

    // Không lưu thông báo này

    this.appGateway.server
      .to(`user_${payload.userId}`)
      .emit("receive_notifications", [newNotif]);
  }

  // Thông báo khi phòng bị báo cáo (Gửi cho chủ phòng)
  @OnEvent("notification.room_reported", { async: true })
  async handleRoomReported(payload: {
    userId: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      const newNotif = await this.notificationModel.create({
        userId: payload.userId,
        type: "ROOM_REPORTED",
        metadata: payload.metadata,
        isRead: false,
        isNotified: false,
        canPopup: true,
      });

      this.toggleUnreadStatus(payload.userId, true);

      this.appGateway.server
        .to(`user_${payload.userId}`)
        .emit("receive_notifications", [newNotif]);
    } catch (error) {
      console.error("Lỗi khi tạo thông báo ROOM_REPORTED:", error);
    }
  }

  // Thông báo kết quả báo cáo (Gửi cho người báo cáo)
  @OnEvent("notification.report_resolved", { async: true })
  async handleReportResolved(payload: {
    userId: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      const newNotif = await this.notificationModel.create({
        userId: payload.userId,
        type: "REPORT_RESOLVED",
        metadata: payload.metadata,
        isRead: false,
        isNotified: false,
        canPopup: true,
      });

      this.toggleUnreadStatus(payload.userId, true);

      this.appGateway.server
        .to(`user_${payload.userId}`)
        .emit("receive_notifications", [newNotif]);
    } catch (error) {
      console.error("Lỗi khi tạo thông báo REPORT_RESOLVED:", error);
    }
  }

  // Thông báo khi phòng bị khoá (Gửi cho chủ phòng)
  @OnEvent("notification.room_blocked", { async: true })
  async handleRoomBlocked(payload: {
    userId: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      const newNotif = await this.notificationModel.create({
        userId: payload.userId,
        type: "ROOM_BLOCKED",
        metadata: payload.metadata,
        isRead: false,
        isNotified: false,
        canPopup: true,
      });

      this.toggleUnreadStatus(payload.userId, true);

      this.appGateway.server
        .to(`user_${payload.userId}`)
        .emit("receive_notifications", [newNotif]);
    } catch (error) {
      console.error("Lỗi khi tạo thông báo ROOM_BLOCKED:", error);
    }
  }
}
