// src/meetings/meetings.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Meeting, MeetingDocument } from "./schemas/meeting.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { AccessToken, RoomServiceClient, TrackType } from "livekit-server-sdk";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import {
  ErrorCode,
  MeetingDeviceStatus,
  MeetingJoinResponse,
  PresignedUploadResponse,
  RoomMemberStatus,
} from "@tobomeet/shared/types";
import { MeetingsGateway } from "./meetings.gateway";
import { AppException } from "../core/exceptions/app.exception";
import { SupabaseService } from "../supabase/supabase.service";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class MeetingsService {
  private livekitRoomService: RoomServiceClient;
  private readonly BUCKET_NAME = "meeting-chat";
  constructor(
    private eventEmitter: EventEmitter2,
    private readonly supabaseService: SupabaseService,
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
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
   * Tham gia hoặc tự động khởi tạo mã cuộc họp lần đầu nếu chưa có ai tạo trong kênh
   * Chỉ cho phép 1 thiết bị vào 1 kênh họp tại 1 thời điểm
   */
  async joinOrCreateMeeting(
    roomId: string,
    channelId: string,
    userId: string,
    deviceId: string,
    displayName?: string,
    forceSwitch?: boolean,
  ): Promise<MeetingJoinResponse> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
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

    // Nếu chưa có cuộc họp nào, tiến hành tạo mới 1 lần duy nhất (lazy init)
    if (!meeting) {
      const randomString = Math.random().toString(36).substring(2, 9);
      const meetingCode = `meet-${roomId.substring(0, 4)}-${randomString}`;

      meeting = await this.meetingModel.create({
        roomId,
        channelId,
        meetingCode,
        hostId: userId,
      });
    }

    const isMeetingStarting = this.isRoomActive(meeting.meetingCode);

    // Chỉ thông báo lần đầu khi phòng chưa active
    if (isMeetingStarting) {
      this.meetingsGateway.notifyMeetingStatus(channelId, {
        isOngoing: true,
        meetingCode: meeting.meetingCode,
      });
    }

    if (!apiKey || !apiSecret) {
      // Không gửi chi tiết lỗi hệ thống cho client
      console.error("Chưa cấu hình LiveKit API Key/Secret ở file .env");
      throw new AppException(ErrorCode.SERVER_ERROR);
    }

    // Chỉ dùng đúng userId làm định danh duy nhất
    const uniqueIdentity = userId;

    const userInRoom = room.members.find((m) => m.userId === userId);
    const userRole = userInRoom ? userInRoom.role : "stranger";
    const hasAdminPowers = userRole === "owner" || userRole === "admin";

    const at = new AccessToken(apiKey, apiSecret, {
      identity: uniqueIdentity,
      name: finalDisplayName,
      metadata: JSON.stringify({
        deviceId: deviceId, // xác định thiết bị nào đang trong cuộc họp
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
      status: "ongoing",
      isHost: meeting.hostId === userId,
      displayName: finalDisplayName,

      roomId: roomId.toString(),
      channelId: channelId.toString(),
      channelName: currentChannel?.name,
    };
  }

  /**
   * Kiểm tra xem thiết bị hiện tại có đang nằm trong cuộc họp của kênh này không.
   */
  async getDeviceStatus(
    roomId: string,
    channelId: string,
    userId: string,
    deviceId: string,
  ): Promise<MeetingDeviceStatus> {
    const meeting = await this.meetingModel
      .findOne({
        roomId,
        channelId,
      })
      .exec();

    if (!meeting || !this.livekitRoomService) {
      return { isJoinedOnThisDevice: false, meetingCode: null };
    }

    try {
      // Hỏi trực tiếp LiveKit xem có ai đang trong phòng không
      const participants = await this.livekitRoomService.listParticipants(
        meeting.meetingCode,
      );

      // Tìm xem user này có đang kết nối không
      const userParticipant = participants.find((p) => p.identity === userId);

      if (userParticipant && userParticipant.metadata) {
        try {
          // Giải mã metadata để lấy deviceId
          const meta = JSON.parse(userParticipant.metadata);

          if (meta.deviceId === deviceId) {
            return {
              isJoinedOnThisDevice: true,
              meetingCode: meeting.meetingCode,
            };
          }
        } catch (parseError) {
          console.error("Lỗi parse metadata từ LiveKit:", parseError);
        }
      }

      // Có người trong phòng nhưng không phải là thiết bị này
      return { isJoinedOnThisDevice: false, meetingCode: meeting.meetingCode };
    } catch (error) {
      console.log(error);
      // Khi không có ai trong phòng, LiveKit SFU tự động dọn dẹp (xóa) phòng.
      return { isJoinedOnThisDevice: false, meetingCode: meeting.meetingCode };
    }
  }

  /**
   * Kiểm tra xem một người dùng có phải là thành viên chính thức của phòng hay không
   * (Dựa vào mã cuộc họp meetingCode)
   * Phục vụ việc chuyển hướng (Redirect) khi rời phòng hoặc phòng đã kết thúc.
   */
  async getMemberStatus(
    meetingCode: string,
    userId: string,
  ): Promise<RoomMemberStatus> {
    const meeting = await this.meetingModel.findOne({ meetingCode }).exec();

    if (!meeting) {
      return { isMember: false, roomId: null };
    }

    const room = await this.roomModel.findById(meeting.roomId).exec();

    if (!room) {
      return { isMember: false, roomId: null };
    }

    const userInRoom = room.members.find((m) => m.userId === userId);
    const isMember = !!userInRoom;

    return {
      isMember,
      roomId: isMember ? meeting.roomId : undefined,
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

  /**
   * Tham gia cuộc họp bằng link/code
   * Tất cả những ai đã đăng nhập đều dùng được, kể cả thành viên trong phòng
   * Không cho người bên ngoài phòng tự ý tạo cuộc họp trước
   */
  async joinMeetingByCode(
    meetingCode: string,
    userId: string,
    deviceId: string,
    displayName?: string,
  ): Promise<MeetingJoinResponse> {
    const meeting = await this.meetingModel
      .findOne({
        meetingCode,
      })
      .exec();

    if (!meeting) {
      throw new AppException(ErrorCode.ROOM_OR_CHANNEL_NOT_FOUND);
    }

    const isActuallyOngoing = await this.isRoomActive(meeting.meetingCode);

    // Chặn vào phòng bằng code(link) nếu đã kết thúc
    // Chặn refresh khi phòng còn duy nhất 1 người
    if (!isActuallyOngoing)
      throw new AppException(ErrorCode.MEETING_NOT_STARTED_OR_ENDED);

    return this.joinOrCreateMeeting(
      meeting.roomId,
      meeting.channelId,
      userId,
      deviceId,
      displayName,
      false,
    );
  }

  /**
   * Lấy trạng thái cuộc họp hiện tại của một kênh
   * (Nâng cấp: Xác thực trạng thái thực tế trực tiếp từ LiveKit)
   */
  async getActiveMeeting(roomId: string, channelId: string) {
    const meeting = await this.meetingModel
      .findOne({
        roomId,
        channelId,
      })
      .exec();

    if (!meeting) {
      return {
        isOngoing: false,
        meetingCode: null,
        hostId: null,
      };
    }

    const isActuallyOngoing = await this.isRoomActive(meeting.meetingCode);

    return {
      isOngoing: isActuallyOngoing,
      meetingCode: meeting.meetingCode,
      hostId: meeting.hostId,
    };
  }

  /**
   * Xoá người dùng ra khỏi cuộc họp
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

      this.eventEmitter.emit("notification.participant_removed", {
        userId: participantIdentity, // Gửi thông báo cho người bị xoá
        metadata: {
          meetingCode: meetingCode,
        },
      });
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
        await this.endMeetingByCode(meetingCode);

        await this.forceDeleteLiveKitRoom(meetingCode);
      }
    } catch (error) {
      // Bỏ qua lỗi nếu phòng đã không còn tồn tại trên LiveKit
      console.log(`Phòng ${meetingCode} có thể đã được dọn dẹp.`, error);
    }
  }

  /**
   * Bật tắt chat trong cuộc họp
   */
  async toggleRoomChat(meetingCode: string, isChatEnabled: boolean) {
    if (!this.livekitRoomService) {
      throw new AppException(ErrorCode.SERVER_ERROR);
    }

    try {
      const metadataString = JSON.stringify({ isChatEnabled });

      await this.livekitRoomService.updateRoomMetadata(
        meetingCode,
        metadataString,
      );
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái chat:", error);
      throw new BadRequestException("Không thể cập nhật trạng thái chat");
    }
  }

  /**
   * Tắt Mic hoặc Camera của người dùng
   */
  async muteParticipantTrack(
    meetingCode: string,
    participantIdentity: string,
    trackType: "audio" | "video",
  ) {
    if (!this.livekitRoomService) return;
    try {
      const participant = await this.livekitRoomService.getParticipant(
        meetingCode,
        participantIdentity,
      );
      const targetTrackType =
        trackType === "audio" ? TrackType.AUDIO : TrackType.VIDEO;

      // Tìm track (luồng dữ liệu) tương ứng đang được phát
      const track = participant.tracks.find((t) => t.type === targetTrackType);
      if (track) {
        // Ép tắt track đó
        await this.livekitRoomService.mutePublishedTrack(
          meetingCode,
          participantIdentity,
          track.sid,
          true,
        );
      }
    } catch (error) {
      console.error(`Lỗi khi tắt ${trackType}:`, error);
      throw new BadRequestException("Không thể thao tác trên người dùng này");
    }
  }

  // utils, helpers

  async endMeetingByCode(meetingCode: string) {
    const meeting = await this.meetingModel.findOne({
      meetingCode,
    });

    if (meeting) {
      console.log(`Đã đóng cuộc họp: ${meetingCode}`);

      // Cập nhật trạng thái cuộc họp mới cho tất cả người dùng đang ở kênh này (Socket.io)
      this.meetingsGateway.notifyMeetingStatus(meeting.channelId, {
        isOngoing: false,
        meetingCode: null,
      });
    }
  }

  async isRoomActive(meetingCode: string): Promise<boolean> {
    let isActuallyOngoing = false;

    if (this.livekitRoomService) {
      try {
        const rooms = await this.livekitRoomService.listRooms([meetingCode]);

        // Nếu mảng trả về có chứa phòng, nghĩa là phòng THỰC SỰ ĐANG TỒN TẠI
        if (rooms && rooms.length > 0) {
          isActuallyOngoing = true;
        } else {
          // Trả về mảng rỗng nghĩa là phòng đã bị xóa / chưa được tạo
          isActuallyOngoing = false;
        }
      } catch (error) {
        console.log(error);
        // Lỗi thường do LiveKit đã giải tán phòng khi trống
        isActuallyOngoing = false;
      }
    }

    return isActuallyOngoing;
  }
}
