// src/meetings/meetings.service.ts
import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Meeting, MeetingDocument } from "./schemas/meeting.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import {
  RoomActivity,
  RoomActivityDocument,
} from "../rooms/schemas/room-activity.schema";
import {
  ErrorCode,
  MeetingJoinResponse,
  PresignedUploadResponse,
} from "@tobomeet/shared/types";
import { MeetingsGateway } from "./meetings.gateway";
import { AppException } from "../core/exceptions/app.exception";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseService } from "../supabase/supabase.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class MeetingsService {
  private livekitRoomService: RoomServiceClient;
  private supabase: SupabaseClient;
  private readonly BUCKET_NAME = "meeting-chat";
  constructor(
    private eventEmitter: EventEmitter2,
    private readonly supabaseService: SupabaseService,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(RoomActivity.name)
    private activityModel: Model<RoomActivityDocument>,
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
   * Chỉ cho phép 1 thiết bị vào 1 kênh họp tại 1 thời điểm
   */
  async joinOrCreateMeeting(
    roomId: string,
    channelId: string,
    userId: string,
    displayName?: string,
    forceSwitch?: boolean,
  ): Promise<MeetingJoinResponse> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      "channels._id": channelId,
    });

    if (!room) {
      throw new AppException(ErrorCode.ROOM_OR_CHANNEL_NOT_FOUND);
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
          // Nếu là yêu cầu chuyển thiết bị
          // Tạo token mới và join vào, thiết bị khác sẽ tự động ngắt kết nối
          if (forceSwitch) {
            console.log(`Tiến hành cấp Token thế chỗ cho user ${userId}`);
          } else {
            throw new AppException(ErrorCode.ALREADY_IN_MEETING);
          }
        }
      } catch (error) {
        if (
          error instanceof AppException ||
          error instanceof BadRequestException
        ) {
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

      // Cập nhật trạng thái phòng họp thành active
      await this.roomModel.updateOne({ _id: roomId }, { status: "active" });

      // Ghi nhận hoạt động phòng
      await this.activityModel.create({
        roomId,
        type: "MEETING_STARTED",
        metadata: {
          userId,
          displayName: finalDisplayName,
          details: `Chủ phòng bắt đầu cuộc họp (Mã cuộc họp: ${meetingCode})`,
        },
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
      // Không gửi chi tiết lỗi hệ thống cho client
      console.error("Chưa cấu hình LiveKit API Key/Secret ở file .env");
      throw new AppException(ErrorCode.SERVER_ERROR);
    }

    // HƯNG NOTE LẠI: CHÌA KHOÁ ĐỂ CUỘC HỌP CHỈ DIỄN RA TRÊN 1 THIẾT BỊ
    // Chỉ dùng đúng userId làm định danh duy nhất
    const uniqueIdentity = userId;

    const userInRoom = room.members.find((m) => m.userId === userId);
    if (
      !userInRoom ||
      userInRoom.isLeft === true ||
      userInRoom.status === "REMOVED" ||
      userInRoom.status === "LEFT"
    ) {
      throw new ForbiddenException("Bạn không còn là thành viên của phòng này");
    }
    const userRole = userInRoom.role;
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

    const currentChannel = room.channels.find(
      (c) => c._id.toString() === channelId.toString(),
    );

    return {
      token: await at.toJwt(),
      meetingCode: meeting.meetingCode,
      status: meeting.status,
      isHost: meeting.hostId === userId,

      roomId: roomId.toString(),
      channelId: channelId.toString(),
      channelName: currentChannel?.name,
    };
  }

  /**
   * Sinh presigned url upload cho meeting chat
   */
  async generatePresignedUrl(
    originalFileName: string,
    meetingCode: string,
  ): Promise<PresignedUploadResponse> {
    try {
      // Chống trùng lặp tên file (Thêm timestamp và chuỗi ngẫu nhiên)
      const fileExtension = originalFileName.includes(".")
        ? originalFileName.split(".").pop()
        : "bin";
      const safeName = originalFileName
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 20);
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${safeName}.${fileExtension}`;

      // Phân loại theo meeting code
      const filePath = `${meetingCode}/${uniqueFileName}`;

      // Gọi hàm tạo URL upload tạm thời (Hết hạn sau 60 giây)
      const { data, error } = await this.supabaseService.admin.storage
        .from(this.BUCKET_NAME)
        .createSignedUploadUrl(filePath);

      if (error) {
        console.error("Supabase Storage Error:", error);
        throw new AppException(ErrorCode.SERVER_ERROR);
      }

      // Lấy Public URL để lưu vào database
      const { data: publicUrlData } = this.supabaseService.admin.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      return {
        presignedUrl: data.signedUrl,
        publicUrl: publicUrlData.publicUrl,
      };
    } catch (error) {
      console.error(error);
      throw new AppException(ErrorCode.SERVER_ERROR);
    }
  }

  async joinMeetingByCode(
    meetingCode: string,
    userId: string,
    displayName?: string,
  ): Promise<MeetingJoinResponse> {
    // Tra cứu ngược từ Database xem meetingCode này thuộc về Room và Channel nào
    const meeting = await this.meetingModel
      .findOne({
        meetingCode,
        status: "ongoing", // Chỉ cho phép vào nếu cuộc họp đang diễn ra
      })
      .exec();

    if (!meeting) {
      throw new AppException(ErrorCode.ROOM_OR_CHANNEL_NOT_FOUND);
    }

    // Gọi lại hàm joinOrCreateMeeting gốc bằng các ID đã tìm thấy trong DB
    return this.joinOrCreateMeeting(
      meeting.roomId,
      meeting.channelId,
      userId,
      displayName,
      false,
    );
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
      console.error("LiveKit Admin Client chưa được cấu hình");
      throw new AppException(ErrorCode.SERVER_ERROR);
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
        // 1. Cập nhật Database
        await this.endMeetingByCode(meetingCode);

        // 2. Ép giải tán phòng
        await this.forceDeleteLiveKitRoom(meetingCode);
      }
    } catch (error) {
      // Bỏ qua lỗi nếu phòng đã không còn tồn tại trên LiveKit
      console.log(`Phòng ${meetingCode} có thể đã được dọn dẹp.`, error);
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

      // Cập nhật trạng thái phòng họp thành ended (nếu không có meeting ongoing khác)
      const otherOngoing = await this.meetingModel
        .findOne({ roomId: meeting.roomId, status: "ongoing" })
        .exec();
      if (!otherOngoing) {
        await this.roomModel.updateOne(
          { _id: meeting.roomId, status: { $ne: "disbanded" } },
          { status: "ended" },
        );
      }

      // Ghi nhận hoạt động phòng
      await this.activityModel.create({
        roomId: meeting.roomId,
        type: "MEETING_ENDED",
        metadata: {
          details: `Cuộc họp đã kết thúc (Mã cuộc họp: ${meetingCode})`,
        },
      });

      // Cập nhật trạng thái cuộc họp mới cho tất cả người dùng đang ở kênh này (Socket.io)
      this.meetingsGateway.notifyMeetingStatus(meeting.channelId, {
        isOngoing: false,
        meetingCode: null,
      });
    }
  }
}
