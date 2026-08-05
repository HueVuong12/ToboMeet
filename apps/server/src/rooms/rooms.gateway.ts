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
export class RoomsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage("join_room")
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`room_${roomId}`);
    console.log(
      `[Socket] Client ${client.id} joined room channel: room_${roomId}`,
    );
  }

  @SubscribeMessage("leave_room")
  handleLeaveRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`room_${roomId}`);
    console.log(
      `[Socket] Client ${client.id} left room channel: room_${roomId}`,
    );
  }

  /**
   * Phát tín hiệu cập nhật phòng họp realtime
   */
  notifyRoomUpdated(
    roomId: string,
    data: { type: string; [key: string]: any },
  ) {
    this.server.to(`room_${roomId}`).emit("room_updated", data);
  }

  /**
   * Xử lý khi user chủ động rời khỏi một kênh riêng tư:
   * 1. Buộc tất cả socket của user đó rời Socket.IO room của channel (socket.leave)
   *    → user sẽ không nhận thêm bất kỳ event nào của channel sau khi rời.
   * 2. Broadcast room_updated(channel_member_left) đến toàn bộ thành viên trong room
   *    → thành viên còn lại thấy danh sách cập nhật ngay.
   */
  notifyUserLeftChannel(
    roomId: string,
    channelId: string,
    userId: string,
    data: { type: string; [key: string]: any },
  ) {
    // Buộc tất cả socket của user vừa rời khỏi Socket.IO room của kênh đó
    this.server.in(`user_${userId}`).socketsLeave(channelId);

    // Broadcast cho toàn bộ thành viên trong phòng (bao gồm cả user vừa rời nếu còn kết nối)
    // để sidebar/member list cập nhật realtime
    this.server.to(`room_${roomId}`).emit("room_updated", data);
  }

  /**
   * Thông báo trực tiếp cho người dùng vừa được thêm vào phòng
   * - Emit trực tiếp đến channel cá nhân của user: user_${targetUserId}
   * - Tự động cho tất cả các socket kết nối của user đó join vào room_${roomId}
   */
  notifyUserRoomAdded(targetUserId: string, roomId: string, payload: any) {
    // 1. Tự động join tất cả socket đang online của user vào room_${roomId}
    const userRoomName = `user_${targetUserId}`;
    this.server.in(userRoomName).socketsJoin(`room_${roomId}`);

    // 2. Emit sự kiện đến channel của user để client làm mới danh sách phòng và RTK cache
    this.server.to(userRoomName).emit("user_room_added", {
      roomId,
      addedUserId: targetUserId,
      room: payload,
    });
  }
}
