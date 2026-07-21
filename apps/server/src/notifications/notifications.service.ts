import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AppGateway } from "../core/gateways/app.gateway";
import {
  Notification,
  NotificationDocument,
} from "./schemas/notification.schema";

@Injectable()
export class NotificationsService {
  constructor(
    private appGateway: AppGateway,

    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

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
      });

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
      }));

      const insertedNotifs = await this.notificationModel.insertMany(
        notificationsToInsert,
      );

      insertedNotifs.forEach((notif) => {
        this.appGateway.server
          .to(`user_${notif.userId}`)
          .emit("receive_notifications", [notif]);
      });
    } catch (error) {
      console.error(error);
    }
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
      });

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
      });

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
      });

      this.appGateway.server
        .to(`user_${payload.userId}`)
        .emit("receive_notifications", [newNotif]);
    } catch (error) {
      console.error("Lỗi khi tạo thông báo ROOM_BLOCKED:", error);
    }
  }
}
