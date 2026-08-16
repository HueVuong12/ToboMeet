import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { AppException } from "../core/exceptions/app.exception";
import {
  ErrorCode,
  LivekitBreakoutRoom,
  LivekitRoomMetadata,
  ParticipantMetadata,
} from "@tobomeet/shared/types";

export interface CreateBreakoutRoomDto {
  name: string; // VD: "Nhóm 1 - Thảo luận Frontend"
  maxParticipants?: number; // Giới hạn số người (tuỳ chọn)
  durationMinutes?: number; // Thời gian tồn tại của phòng (tuỳ chọn)
}

@Injectable()
export class BreakoutRoomsService {
  private livekitRoomService: RoomServiceClient;

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
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
   * HOST: Bắt đầu chia phòng Breakout (Eager Init + Auto ID)
   * Client chỉ truyền cấu hình, Backend tự sinh ID và giới hạn phòng
   */
  async startBreakoutSession(
    mainMeetingCode: string,
    roomConfigs: CreateBreakoutRoomDto[],
  ) {
    if (!this.livekitRoomService)
      throw new AppException(ErrorCode.SERVER_ERROR);

    try {
      const livekitRooms = await this.livekitRoomService.listRooms([
        mainMeetingCode,
      ]);
      let currentMeta: LivekitRoomMetadata = {} as LivekitRoomMetadata;

      if (livekitRooms && livekitRooms.length > 0 && livekitRooms[0].metadata) {
        try {
          currentMeta = JSON.parse(livekitRooms[0].metadata);
        } catch (e) {
          console.error("Lỗi parse metadata phòng chính", e);
        }
      }

      // Map dữ liệu từ Client thành cấu trúc nội bộ có ID tự tăng
      const breakoutRooms: LivekitBreakoutRoom[] = roomConfigs.map(
        (config, index) => {
          return {
            id: `sub_${index + 1}`, // Tự động sinh: sub_1, sub_2, sub_3...
            name: config.name,
            maxParticipants: config.maxParticipants || 0, // 0 = không giới hạn
            durationMinutes: config.durationMinutes || 0,
          };
        },
      );

      // Khởi tạo phòng với ID tự sinh và giới hạn số lượng người
      const createRoomPromises = breakoutRooms.map(async (room) => {
        const fullSubRoomId = `${mainMeetingCode}_${room.id}`;

        try {
          await this.livekitRoomService.createRoom({
            name: fullSubRoomId,
            emptyTimeout: 10 * 60,
            maxParticipants: room.maxParticipants, // Tận dụng tính năng chặn người của LiveKit
            metadata: JSON.stringify({
              room_type: "breakout",
              parent_room: mainMeetingCode,
              parent_metadata: currentMeta,
              duration_minutes: room.durationMinutes, // Lưu thời lượng vào metadata của phòng phụ
              status: "active",
            }),
          });
        } catch (error) {
          console.error(`Lỗi tạo phòng breakout ${fullSubRoomId}:`, error);
        }
      });

      await Promise.all(createRoomPromises);

      // Lưu danh sách phòng (đã có ID) vào Metadata phòng chính
      const metadataString = JSON.stringify({
        ...currentMeta,
        breakout_session: {
          status: "active",
          rooms: breakoutRooms,
          startedAt: Date.now(),
        },
      });

      await this.livekitRoomService.updateRoomMetadata(
        mainMeetingCode,
        metadataString,
      );
    } catch (error) {
      console.error("Lỗi khi tạo Breakout Session:", error);
      throw new BadRequestException("Không thể tạo phiên thảo luận nhóm.");
    }
  }

  /**
   * HOST: Kết thúc phiên Breakout
   * Xoá trạng thái breakout ở phòng chính và gửi tín hiệu 'closing' vào các phòng phụ
   */
  async endBreakoutSession(mainMeetingCode: string) {
    if (!this.livekitRoomService) return;

    try {
      // BƯỚC A: Cập nhật Metadata phòng chính về lại bình thường
      const mainRooms = await this.livekitRoomService.listRooms([
        mainMeetingCode,
      ]);
      let currentMeta: LivekitRoomMetadata = {} as LivekitRoomMetadata;

      if (mainRooms.length > 0 && mainRooms[0].metadata) {
        currentMeta = JSON.parse(mainRooms[0].metadata);
      }

      // Lưu lại danh sách phòng để gửi tín hiệu đóng
      const breakoutRooms = currentMeta.breakout_session?.rooms || [];

      // Xóa thông tin breakout khỏi metadata
      delete currentMeta.breakout_session;
      await this.livekitRoomService.updateRoomMetadata(
        mainMeetingCode,
        JSON.stringify(currentMeta),
      );

      // BƯỚC B: Phát tín hiệu 'closing' cho toàn bộ phòng phụ
      // Để Client của user ở phòng phụ bắt được sự kiện và gọi API thoát
      for (const room of breakoutRooms) {
        const fullSubRoomId = `${mainMeetingCode}_${room.id}`;

        try {
          const subRooms = await this.livekitRoomService.listRooms([
            fullSubRoomId,
          ]);
          if (subRooms.length > 0) {
            const subMeta = subRooms[0].metadata
              ? JSON.parse(subRooms[0].metadata)
              : {};
            subMeta.status = "closing"; // Bắn tín hiệu đóng

            await this.livekitRoomService.updateRoomMetadata(
              fullSubRoomId,
              JSON.stringify(subMeta),
            );
          }
        } catch (e) {
          // Bỏ qua nếu phòng phụ đã trống và tự giải tán
          console.log(e);
        }
      }
    } catch (error) {
      console.log(error);
      throw new BadRequestException("Không thể kết thúc phiên thảo luận nhóm.");
    }
  }

  /**
   * PARTICIPANT: Tham gia vào Breakout Room
   * Vì phòng đã được Eager Init, chỉ cần check quyền và cấp Token
   */
  async joinBreakoutRoom(
    mainMeetingCode: string,
    breakoutRoomId: string,
    userId: string,
    deviceId: string,
  ) {
    if (!this.livekitRoomService)
      throw new AppException(ErrorCode.SERVER_ERROR);

    try {
      const participants =
        await this.livekitRoomService.listParticipants(mainMeetingCode);
      const isActuallyInMainRoom = participants.some(
        (p) => p.identity === userId,
      );

      if (!isActuallyInMainRoom) {
        throw new BadRequestException(
          "Bạn phải đang ở phòng họp chính mới được vào phòng thảo luận.",
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Phòng họp chính không hoạt động.");
    }

    const user = await this.userModel.findOne({ supabaseId: userId }).exec();
    const finalDisplayName = user?.displayName || "Người dùng ẩn danh";
    const avatarUrl = user?.avatarUrl || "";

    const fullBreakoutRoomName = `${mainMeetingCode}_${breakoutRoomId}`;

    return this.generateLivekitToken(
      fullBreakoutRoomName,
      userId,
      finalDisplayName,
      avatarUrl,
      deviceId,
    );
  }

  /**
   * PARTICIPANT: Thoát Breakout Room để quay về
   * KHÔNG cần Client truyền mainMeetingCode. Đọc trực tiếp từ Metadata của phòng Breakout.
   */
  async returnToMainRoom(
    fullBreakoutRoomName: string, // VD: meet-1234_sub_1. Client truyền lên cái này.
    userId: string,
    deviceId: string,
  ) {
    if (!this.livekitRoomService)
      throw new AppException(ErrorCode.SERVER_ERROR);

    // Lấy thông tin phòng Breakout hiện tại để tự suy ra Main Room
    let parentRoomCode = "";
    try {
      const subRooms = await this.livekitRoomService.listRooms([
        fullBreakoutRoomName,
      ]);
      if (subRooms.length === 0) {
        throw new BadRequestException(
          "Phòng thảo luận không tồn tại hoặc đã bị đóng.",
        );
      }

      if (subRooms[0].metadata) {
        const subMeta = JSON.parse(subRooms[0].metadata);
        parentRoomCode = subMeta.parent_room;
      }

      if (!parentRoomCode) {
        throw new BadRequestException(
          "Không tìm thấy thông tin phòng họp chính.",
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        "Lỗi hệ thống khi trích xuất dữ liệu phòng.",
      );
    }

    // Xác thực xem User có đang ở trong Breakout này không
    try {
      const participants =
        await this.livekitRoomService.listParticipants(fullBreakoutRoomName);
      const isActuallyInBreakout = participants.some(
        (p) => p.identity === userId,
      );

      if (!isActuallyInBreakout) {
        throw new BadRequestException(
          "Yêu cầu không hợp lệ. Bạn không có mặt trong phòng thảo luận này.",
        );
      }
    } catch (error) {
      // Bỏ qua nếu user gọi API khi phòng vừa bị LiveKit xoá tự động do trống
      console.log(error);
    }

    // Lấy thông tin User & Sinh Token để vào lại Main Room
    const user = await this.userModel.findOne({ supabaseId: userId }).exec();
    const finalDisplayName = user?.displayName || "Người dùng ẩn danh";
    const avatarUrl = user?.avatarUrl || "";

    // Sinh token cấp quyền vào lại phòng chính
    return this.generateLivekitToken(
      parentRoomCode,
      userId,
      finalDisplayName,
      avatarUrl,
      deviceId,
    );
  }

  /**
   * Helper: Hàm sinh Token chuẩn của LiveKit
   */
  private async generateLivekitToken(
    roomName: string,
    userId: string,
    displayName: string,
    avatarUrl: string,
    deviceId: string,
  ) {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
      ttl: "1h",
      metadata: JSON.stringify({
        deviceId: deviceId,
        avatarUrl: avatarUrl,
        status: "joined",
      } as ParticipantMetadata),
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishSources: [
        TrackSource.CAMERA,
        TrackSource.MICROPHONE,
        TrackSource.SCREEN_SHARE,
      ],
      canUpdateOwnMetadata: true,
    });

    return {
      token: await at.toJwt(),
      roomId: roomName,
    };
  }
}
