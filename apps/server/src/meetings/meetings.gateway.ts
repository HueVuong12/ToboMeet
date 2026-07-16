// src/meetings/meetings.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  },
})
export class MeetingsGateway {
  @WebSocketServer()
  server: Server;

  // Khi User bấm vào 1 kênh ở Frontend, sẽ gửi event này lên
  @SubscribeMessage("join_channel")
  handleJoinChannel(
    @MessageBody() channelId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(channelId);
    console.log(`[Socket] Client ${client.id} joined channel: ${channelId}`);
  }

  // Khi User chuyển kênh khác, gửi event rời kênh cũ
  @SubscribeMessage("leave_channel")
  handleLeaveChannel(
    @MessageBody() channelId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(channelId);
  }

  @SubscribeMessage("request_switch_device")
  handleRequestSwitch(
    @MessageBody() data: { userId: string; channelId: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Gửi yêu cầu cho máy đang trong cuộc họp
    client.to(`user_${data.userId}`).emit("switch_device_requested", data);
  }

  @SubscribeMessage("accept_switch_device")
  handleAcceptSwitch(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    // Nếu có targetSocketId, gửi ĐÍCH DANH cho Máy B (Point-to-Point)
    if (data.targetSocketId) {
      this.server.to(data.targetSocketId).emit("switch_device_accepted", data);
    } else {
      // Fallback an toàn nếu thiếu ID
      client.to(`user_${data.userId}`).emit("switch_device_accepted", data);
    }
  }

  /**
   * Cập nhật trạng thái cuộc họp mới cho tất cả người dùng trong kênh
   */
  notifyMeetingStatus(
    channelId: string,
    data: { isOngoing: boolean; meetingCode?: string },
  ) {
    this.server.to(channelId).emit("meeting_status_changed", data);
  }
}
