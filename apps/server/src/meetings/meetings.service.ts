// src/meetings/meetings.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Meeting, MeetingDocument } from "./schemas/meeting.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { MeetingJoinResponse } from "@tobomeet/shared/types";
import { MeetingsGateway } from "./meetings.gateway";

@Injectable()
export class MeetingsService {
  private livekitRoomService: RoomServiceClient;
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @Inject(forwardRef(() => MeetingsGateway))
    private readonly meetingsGateway: MeetingsGateway,
  ) {
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

  /**
   * Tham gia hoặc tự động khởi tạo cuộc họp nếu chưa có ai tạo trong kênh
   */
  async joinOrCreateMeeting(
    roomId: string,
    channelId: string,
    userId: string,
    displayName?: string,
  ): Promise<MeetingJoinResponse> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      "channels._id": channelId,
    });

    if (!room) {
      throw new NotFoundException("Phòng hoặc Kênh không tồn tại");
    }

    // Thông tin tên hiển thị của User để làm Identity trong LiveKit
    const user = await this.userModel.findOne({ supabaseId: userId }).exec();
    const finalDisplayName =
      displayName || user?.displayName || "Người dùng ẩn danh";
    const avatarUrl = user?.avatarUrl || "";

    // Tìm cuộc họp đang diễn ra (ongoing) trong kênh này
    let meeting = await this.meetingModel
      .findOne({
        roomId,
        channelId,
        status: "ongoing",
      })
      .exec();

    // Chặn user tham gia cuộc họp nếu họ đã tham gia trên một thiết bị khác (tránh join nhiều tab)
    if (meeting && this.livekitRoomService) {
      try {
        const participants = await this.livekitRoomService.listParticipants(
          meeting.meetingCode,
        );

        const isAlreadyInThisRoom = participants.some((p) =>
          p.identity.startsWith(userId),
        );

        if (isAlreadyInThisRoom) {
          throw new BadRequestException(
            "Bạn đã tham gia cuộc họp này trên một thiết bị hoặc tab khác.",
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
      }
    }

    // Nếu CHƯA CÓ cuộc họp nào, tiến hành tạo mới (Bắt đầu cuộc họp)
    if (!meeting) {
      const randomString = Math.random().toString(36).substring(2, 9);
      const meetingCode = `meet-${roomId.substring(0, 4)}-${randomString}`;

      meeting = await this.meetingModel.create({
        roomId,
        channelId,
        meetingCode,
        status: "ongoing",
        hostId: userId,
      });

      // Cập nhật trạng thái cuộc họp mới cho tất cả người dùng đang ở kênh này (Socket.io)
      this.meetingsGateway.notifyMeetingStatus(channelId, {
        isOngoing: true,
        meetingCode: meeting.meetingCode,
      });
    }

    // Sinh LiveKit Access Token cho người dùng này
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new BadRequestException(
        "Chưa cấu hình LiveKit API Key/Secret ở file .env",
      );
    }

    const uniqueIdentity = `${userId}-${Math.random().toString(36).substring(2, 8)}`;

    const userInRoom = room.members.find((m) => m.userId === userId);
    const userRole = userInRoom ? userInRoom.role : "member";
    const hasAdminPowers = userRole === "owner" || userRole === "admin";

    const at = new AccessToken(apiKey, apiSecret, {
      identity: uniqueIdentity,
      name: finalDisplayName,
      metadata: JSON.stringify({
        avatarUrl: avatarUrl,
        hasAdminPowers: hasAdminPowers,
        role: userRole,
      }),
    });

    at.addGrant({
      roomJoin: true,
      room: meeting.meetingCode,
      canPublish: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });

    return {
      token: await at.toJwt(),
      meetingCode: meeting.meetingCode,
      status: meeting.status,
      isHost: meeting.hostId === userId,
    };
  }

  /**
   * Lấy trạng thái cuộc họp hiện tại của một kênh
   */
  async getActiveMeeting(roomId: string, channelId: string) {
    const meeting = await this.meetingModel
      .findOne({
        roomId,
        channelId,
        status: "ongoing",
      })
      .exec();

    return {
      isOngoing: !!meeting,
      meetingCode: meeting?.meetingCode || null,
      hostId: meeting?.hostId || null,
    };
  }

  /**
   * Đuổi người dùng ra khỏi cuộc họp (Kick)
   */
  async removeParticipant(meetingCode: string, participantIdentity: string) {
    if (!this.livekitRoomService) {
      throw new BadRequestException("LiveKit Admin Client chưa được cấu hình");
    }

    try {
      await this.livekitRoomService.removeParticipant(
        meetingCode,
        participantIdentity,
      );
    } catch (error) {
      console.error("Lỗi khi kick:", error);
      throw new BadRequestException(
        "Không thể kick, có thể người này đã rời phòng",
      );
    }
  }

  /**
   * Ép LiveKit xóa phòng ngay lập tức không cần đợi Timeout
   */
  async forceDeleteLiveKitRoom(meetingCode: string) {
    if (!this.livekitRoomService) return;
    try {
      await this.livekitRoomService.deleteRoom(meetingCode);
    } catch (error) {
      console.error(
        `Không thể xóa phòng ${meetingCode} (có thể đã tự xóa):`,
        error,
      );
    }
  }

  /**
   * Kiểm tra thực tế số người trong phòng, nếu bằng 0 thì ép xóa
   */
  async checkAndCloseEmptyRoom(meetingCode: string) {
    if (!this.livekitRoomService) return;

    try {
      // Gọi API trực tiếp lên LiveKit Server để lấy danh sách người dùng hiện tại
      const participants =
        await this.livekitRoomService.listParticipants(meetingCode);

      if (participants.length === 0) {
        console.log(
          `[Xác nhận] Phòng ${meetingCode} thực sự trống. Đóng ngay lập tức!`,
        );

        // 1. Cập nhật Database
        await this.endMeetingByCode(meetingCode);

        // 2. Ép giải tán phòng
        await this.forceDeleteLiveKitRoom(meetingCode);
      } else {
        console.log(
          `Phòng ${meetingCode} vẫn còn ${participants.length} người. Tiếp tục duy trì.`,
        );
      }
    } catch (error) {
      // Bỏ qua lỗi nếu phòng đã không còn tồn tại trên LiveKit
      console.log(`Phòng ${meetingCode} có thể đã được dọn dẹp.`);
    }
  }

  async endMeetingByCode(meetingCode: string) {
    const meeting = await this.meetingModel.findOne({
      meetingCode,
      status: "ongoing",
    });

    if (meeting) {
      meeting.status = "ended";
      await meeting.save();
      console.log(`Đã đóng cuộc họp: ${meetingCode}`);

      // Cập nhật trạng thái cuộc họp mới cho tất cả người dùng đang ở kênh này (Socket.io)
      this.meetingsGateway.notifyMeetingStatus(meeting.channelId, {
        isOngoing: false,
        meetingCode: null,
      });
    }
  }
}
