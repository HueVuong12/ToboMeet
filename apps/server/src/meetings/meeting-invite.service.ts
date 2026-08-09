import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Notification,
  NotificationDocument,
} from "../notifications/schemas/notification.schema";
import {
  MeetingSession,
  MeetingSessionDocument,
} from "./schemas/meeting-session.schema";
import { AppGateway } from "../core/gateways/app.gateway";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { RoomServiceClient } from "livekit-server-sdk"; // Thêm SDK của LiveKit

@Injectable()
export class MeetingInviteService {
  private livekitRoomService: RoomServiceClient;

  constructor(
    private appGateway: AppGateway,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(MeetingSession.name)
    private sessionModel: Model<MeetingSessionDocument>,
    @InjectModel(Room.name)
    private roomModel: Model<RoomDocument>,
  ) {
    // Khởi tạo LiveKit Client để gọi API trực tiếp
    const livekitHost = process.env.LIVEKIT_API_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (livekitHost && apiKey && apiSecret) {
      this.livekitRoomService = new RoomServiceClient(
        livekitHost,
        apiKey,
        apiSecret,
      );
    }
  }

  async sendMeetingInvite(
    inviterId: string,
    inviteeId: string,
    meetingCode: string,
  ) {
    console.log("người nhận:", inviteeId);
    if (!this.livekitRoomService) {
      throw new BadRequestException("Máy chủ LiveKit chưa được cấu hình.");
    }

    // Kiểm tra phòng LiveKit và lấy danh sách người tham gia
    let livekitRooms;
    let participants;
    try {
      livekitRooms = await this.livekitRoomService.listRooms([meetingCode]);
      if (!livekitRooms || livekitRooms.length === 0) {
        throw new BadRequestException("Cuộc họp hiện không diễn ra.");
      }
      participants =
        await this.livekitRoomService.listParticipants(meetingCode);
    } catch (error) {
      console.log(error);
      throw new BadRequestException("Không thể truy cập thông tin cuộc họp.");
    }

    // Kiểm tra nếu người dùng thực sự đang trong phòng (chống bot spam)
    const isInviterInRoom = participants.some((p) => p.identity === inviterId);
    if (!isInviterInRoom) {
      throw new BadRequestException(
        "Bạn phải đang tham gia cuộc họp mới có thể gửi lời mời.",
      );
    }

    // Trích xuất sessionId từ metadata của LiveKit
    const roomInfo = livekitRooms[0];
    let sessionId = "";
    try {
      if (roomInfo.metadata) {
        const meta = JSON.parse(roomInfo.metadata);
        sessionId = meta.sessionId;
      }
    } catch (e) {
      console.error("Lỗi parse metadata từ LiveKit:", e);
    }

    if (!sessionId) {
      throw new BadRequestException("Không thể xác định phiên họp hiện tại.");
    }

    // Xác thực Session trong Database
    const session = await this.sessionModel.findById(sessionId);
    if (!session || session.status !== "ongoing") {
      throw new BadRequestException(
        "Phiên họp không tồn tại hoặc đã kết thúc.",
      );
    }

    const room = await this.roomModel.findById(session.roomId);
    const roomName = room ? room.name : "Phòng họp";

    // Logic chống spam gửi lời mời và lưu thông báo
    const COOLDOWN_MINUTES = 5;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    const now = new Date();

    const existingNotif = await this.notificationModel.findOne({
      userId: inviteeId,
      type: "MEETING_INVITE",
      "metadata.sessionId": sessionId,
    });

    if (existingNotif) {
      const lastUpdated = existingNotif.updatedAt?.getTime() || 0;
      const timeSinceLastInvite = now.getTime() - lastUpdated;

      if (timeSinceLastInvite < cooldownMs) {
        const waitTime = Math.ceil((cooldownMs - timeSinceLastInvite) / 60000);
        throw new HttpException(
          `Vui lòng đợi ${waitTime} phút nữa để gửi lại lời mời.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      existingNotif.isRead = false;
      existingNotif.metadata = {
        ...existingNotif.metadata,
        inviterId,
        invitedAt: now.toISOString(),
        roomName,
      };
      const updatedNotif = await existingNotif.save();

      this.appGateway.server
        .to(`user_${inviteeId}`)
        .emit("receive_notifications", [updatedNotif]);

      return updatedNotif;
    }

    const newNotif = await this.notificationModel.create({
      userId: inviteeId,
      type: "MEETING_INVITE",
      metadata: {
        sessionId,
        inviterId,
        invitedAt: now.toISOString(),
        roomName,
      },
      isRead: false,
    });

    this.appGateway.server
      .to(`user_${inviteeId}`)
      .emit("receive_notifications", [newNotif]);

    return newNotif;
  }

  async exchangeSessionForCode(userId: string, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);

    if (!session) {
      throw new NotFoundException("Không tìm thấy phiên họp này.");
    }

    if (session.status !== "ongoing") {
      throw new BadRequestException("Phiên họp này đã kết thúc.");
    }

    return {
      meetingCode: session.meetingCode,
      roomId: session.roomId,
      channelId: session.channelId,
    };
  }
}
