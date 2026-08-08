// src/core/gateways/app.gateway.ts
import { InjectModel } from "@nestjs/mongoose";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Model } from "mongoose";
import { Server, Socket } from "socket.io";
import {
  Notification,
  NotificationDocument,
} from "../../notifications/schemas/notification.schema";

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  handleConnection(client: Socket) {
    console.log(`[Socket] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Socket] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join_user_room")
  async handleJoinUserRoom(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user_${userId}`);

    try {
      // Khi người dùng online lại, kiểm tra xem có thông báo nào chưa gửi không
      const unreadNotifs = await this.notificationModel
        .find({ userId: userId, isRead: false })
        .sort({ createdAt: 1 });

      if (unreadNotifs.length > 0) {
        client.emit("receive_notifications", unreadNotifs); // xả tất cả thông báo chưa nhận được
      }
    } catch (error) {
      console.error("[Socket] Lỗi khi đồng bộ thông báo lúc online:", error);
    }
  }

  /**
   * Đánh dấu các thông báo đã được Frontend hiển thị thành "đã đọc"
   */
  @SubscribeMessage("mark_notifications_read")
  async handleMarkNotificationsRead(
    @MessageBody() notificationIds: string[],
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Bỏ qua nếu mảng rỗng để tránh query vô ích xuống DB
      if (!notificationIds || notificationIds.length === 0) return;

      // Update tất cả các record có _id nằm trong mảng notificationIds
      await this.notificationModel.updateMany(
        { _id: { $in: notificationIds } },
        { $set: { isRead: true } },
      );
    } catch (error) {
      console.error("[Socket] Lỗi khi đánh dấu thông báo đã đọc:", error);
    }
  }
}
