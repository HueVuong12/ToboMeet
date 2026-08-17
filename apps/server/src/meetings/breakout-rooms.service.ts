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
  MeetingJoinResponse,
  ParticipantMetadata,
} from "@tobomeet/shared/types";
import { MeetingsService } from "./meetings.service";

export interface CreateBreakoutRoomDto {
  name: string; // VD: "Nhóm 1 - Thảo luận Frontend"
  maxParticipants?: number; // Giới hạn số người (tuỳ chọn)
  durationMinutes?: number; // Thời gian tồn tại của phòng (tuỳ chọn)
}

@Injectable()
export class BreakoutRoomsService {
  private livekitRoomService: RoomServiceClient;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private meetingsService: MeetingsService,
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
   * HOST: Bắt đầu chia phòng Breakout (Eager Init + Auto ID)
   * - Nếu phòng chưa tồn tại → createRoom
   * - Nếu phòng đã tồn tại (kể cả status = closing) → force updateRoomMetadata
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

      if (livekitRooms?.length > 0 && livekitRooms[0].metadata) {
        try {
          currentMeta = JSON.parse(livekitRooms[0].metadata);
        } catch (e) {
          console.error("Lỗi parse metadata phòng chính", e);
        }
      }

      // Map config → cấu trúc nội bộ có ID tự tăng
      const breakoutRooms: LivekitBreakoutRoom[] = roomConfigs.map(
        (config, index) => ({
          id: `sub_${index + 1}`,
          name: config.name,
          maxParticipants: config.maxParticipants || 0,
          durationMinutes: config.durationMinutes || 0,
        }),
      );

      // Tạo / cập nhật từng phòng breakout
      const upsertRoomPromises = breakoutRooms.map(async (room) => {
        const fullSubRoomId = `${mainMeetingCode}_${room.id}`;

        const newMetadata = JSON.stringify({
          room_type: "breakout",
          parent_room: mainMeetingCode,
          parent_metadata: currentMeta,
          duration_minutes: room.durationMinutes,
          status: "active",
        });

        try {
          // Kiểm tra phòng đã tồn tại chưa
          const existing = await this.livekitRoomService.listRooms([
            fullSubRoomId,
          ]);

          if (existing.length > 0) {
            // Phòng đã tồn tại → ghi đè metadata (quan trọng khi status cũ = closing)
            await this.livekitRoomService.updateRoomMetadata(
              fullSubRoomId,
              newMetadata,
            );
            console.log(
              `[Breakout] Đã ghi đè metadata phòng cũ: ${fullSubRoomId}`,
            );
          } else {
            // Phòng chưa tồn tại → tạo mới
            await this.livekitRoomService.createRoom({
              name: fullSubRoomId,
              emptyTimeout: 10 * 60,
              departureTimeout: 10 * 60,
              maxParticipants: room.maxParticipants,
              metadata: newMetadata,
            });
            console.log(`[Breakout] Đã tạo phòng mới: ${fullSubRoomId}`);
          }
        } catch (error) {
          // Fallback an toàn: dù list/create lỗi vẫn cố update metadata
          console.error(
            `Lỗi khi upsert phòng breakout ${fullSubRoomId}, thử force update metadata:`,
            error,
          );
          try {
            await this.livekitRoomService.updateRoomMetadata(
              fullSubRoomId,
              newMetadata,
            );
          } catch (updateErr) {
            console.error(
              `Không thể update metadata cho ${fullSubRoomId}:`,
              updateErr,
            );
          }
        }
      });

      await Promise.all(upsertRoomPromises);

      // Cập nhật metadata phòng chính
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
   * Kiểm tra tính hợp lệ của phòng breakout, check quyền và cấp Token
   */
  async joinBreakoutRoom(
    mainMeetingCode: string,
    breakoutRoomId: string,
    userId: string,
    deviceId: string,
  ) {
    if (!this.livekitRoomService)
      throw new AppException(ErrorCode.SERVER_ERROR);

    const fullBreakoutRoomName = `${mainMeetingCode}_${breakoutRoomId}`;

    // ==========================================
    // BƯỚC 1: KIỂM TRA TÍNH HỢP LỆ CỦA PHÒNG BREAKOUT
    // ==========================================
    try {
      const subRooms = await this.livekitRoomService.listRooms([
        fullBreakoutRoomName,
      ]);

      if (subRooms.length === 0) {
        throw new BadRequestException(
          "Phòng thảo luận không tồn tại hoặc đã đóng.",
        );
      }

      if (subRooms[0].metadata) {
        const meta = JSON.parse(subRooms[0].metadata);

        console.log("meta", meta);

        // Kiểm tra chắc chắn đây là phòng breakout
        if (meta.room_type !== "breakout") {
          throw new BadRequestException(
            "Yêu cầu không hợp lệ. Đây không phải là phòng thảo luận.",
          );
        }

        // (Tuỳ chọn) Kiểm tra thêm trạng thái phòng có đang active không
        if (meta.status !== "active") {
          throw new BadRequestException(
            "Phòng thảo luận này không còn hoạt động.",
          );
        }
      } else {
        throw new BadRequestException("Dữ liệu phòng thảo luận không hợp lệ.");
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        "Lỗi hệ thống khi kiểm tra thông tin phòng.",
      );
    }

    // ==========================================
    // BƯỚC 2: KIỂM TRA NGƯỜI DÙNG CÓ Ở PHÒNG CHÍNH KHÔNG
    // ==========================================
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

    // ==========================================
    // BƯỚC 3: CẤP TOKEN VÀO PHÒNG
    // ==========================================
    const user = await this.userModel.findOne({ supabaseId: userId }).exec();
    const finalDisplayName = user?.displayName || "Người dùng ẩn danh";
    const avatarUrl = user?.avatarUrl || "";

    return this.generateBreakoutToken(
      fullBreakoutRoomName,
      userId,
      finalDisplayName,
      avatarUrl,
      deviceId,
    );
  }

  /**
   * PARTICIPANT: Thoát Breakout Room để quay về
   * Nội suy meetingCode của phòng chính từ metadata
   * Chỉ cho trở về phòng chính nếu đang trong phòng breakout
   */
  async returnToMainRoom(
    fullBreakoutRoomName: string,
    userId: string,
    deviceId: string,
  ): Promise<MeetingJoinResponse> {
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
    const participants =
      await this.livekitRoomService.listParticipants(fullBreakoutRoomName);
    const isActuallyInBreakout = participants.some(
      (p) => p.identity === userId,
    );

    if (!isActuallyInBreakout) {
      throw new BadRequestException(
        "Bạn không có mặt trong phòng thảo luận này.",
      );
    }

    // Lấy thông tin User & Sinh Token để vào lại Main Room
    const user = await this.userModel.findOne({ supabaseId: userId }).exec();
    const finalDisplayName = user?.displayName || "Người dùng ẩn danh";

    // Sinh token cấp quyền vào lại phòng chính
    return this.meetingsService.joinMeetingByCode(
      parentRoomCode,
      userId,
      deviceId,
      finalDisplayName,
    );
  }

  /**
   * Helper: Sinh token cho breakout
   */
  private async generateBreakoutToken(
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
