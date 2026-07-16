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
}
