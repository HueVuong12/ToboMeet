import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { AppException } from "../core/exceptions/app.exception";
import {
  BreakoutRoomMetadata,
  ErrorCode,
  LivekitBreakoutRoom,
  LivekitRoomMetadata,
  MainRoomMetadata,
  MeetingJoinResponse,
  ParticipantMetadata,
} from "@tobomeet/shared/types";
import { MeetingsService } from "./meetings.service";
import { CreateBreakoutRoomDto } from "./dtos/create-breakout-room.dto";

@Injectable()
export class BreakoutRoomsService {
  private livekitRoomService: RoomServiceClient;
  private breakoutTimers: Map<string, NodeJS.Timeout[]> = new Map();
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

  private clearTimersForMeeting(meetingCode: string) {
    const timers = this.breakoutTimers.get(meetingCode);
    if (timers) {
      timers.forEach((timer) => clearTimeout(timer));
      this.breakoutTimers.delete(meetingCode);
      console.log(
        `[Breakout] Đã huỷ các timer đếm ngược cũ của ${meetingCode}`,
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
      const sessionStartedAt = Date.now();

      const livekitRooms = await this.livekitRoomService.listRooms([
        mainMeetingCode,
      ]);
      let currentMeta: LivekitRoomMetadata = {} as LivekitRoomMetadata;

      // Chỉ xử lý cho phòng chính
      if (currentMeta.roomType === "breakout") return;

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

        // metadata cho từng phòng breakout
        const newMetadata = JSON.stringify({
          roomName: room.name,
          roomType: "breakout",
          parentRoom: mainMeetingCode,
          parentMetadata: currentMeta,
          durationMinutes: room.durationMinutes,
          startedAt: sessionStartedAt,
          status: "active",
        } as LivekitRoomMetadata);

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
          } else {
            // Phòng chưa tồn tại → tạo mới
            await this.livekitRoomService.createRoom({
              name: fullSubRoomId,
              emptyTimeout: 10 * 60,
              departureTimeout: 10 * 60,
              maxParticipants: room.maxParticipants,
              metadata: newMetadata,
            });
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
        breakoutSession: {
          status: "active",
          rooms: breakoutRooms,
          startedAt: sessionStartedAt,
        },
      } as LivekitRoomMetadata);

      await this.livekitRoomService.updateRoomMetadata(
        mainMeetingCode,
        metadataString,
      );

      // ===== Gửi tín hiệu join cho người được chỉ định =====
      for (const config of roomConfigs) {
        if (config.assignedUsers && config.assignedUsers.length > 0) {
          // Tìm ID phòng phụ tương ứng (vd: sub_1)
          const assignedRoom = breakoutRooms.find(
            (r) => r.name === config.name,
          );

          if (assignedRoom) {
            const payload = JSON.stringify({
              id: Date.now().toString(),
              type: "SYSTEM",
              command: "FORCE_JOIN_BREAKOUT",
              breakoutRoomId: assignedRoom.id,
              targetUsers: config.assignedUsers,
              timestamp: Date.now(),
            });

            const encoder = new TextEncoder();
            const data = encoder.encode(payload);

            try {
              await this.livekitRoomService.sendData(
                mainMeetingCode,
                data,
                DataPacket_Kind.RELIABLE,
              );
            } catch (err) {
              console.error("Lỗi khi bắn tín hiệu auto-join:", err);
            }
          }
        }
      }

      // ===== Tự động đóng phòng khi hết giờ =====
      this.clearTimersForMeeting(mainMeetingCode);

      const currentTimers: NodeJS.Timeout[] = [];
      let maxDuration = 0;
      const GRACE_PERIOD_MS = 2000;

      breakoutRooms.forEach((room) => {
        if (room.durationMinutes > 0) {
          // Tìm ra thời lượng dài nhất
          if (room.durationMinutes > maxDuration) {
            maxDuration = room.durationMinutes;
          }

          const timeoutMs = room.durationMinutes * 60 * 1000 + GRACE_PERIOD_MS;

          const roomTimer = setTimeout(async () => {
            const fullSubRoomId = `${mainMeetingCode}_${room.id}`;
            try {
              const subRooms = await this.livekitRoomService.listRooms([
                fullSubRoomId,
              ]);

              if (subRooms.length > 0 && subRooms[0].metadata) {
                const subMeta: BreakoutRoomMetadata = JSON.parse(
                  subRooms[0].metadata,
                );

                if (subMeta.status === "active") {
                  subMeta.status = "closing";

                  await this.livekitRoomService.updateRoomMetadata(
                    fullSubRoomId,
                    JSON.stringify(subMeta),
                  );
                  console.log(
                    `[Breakout] Đã tự động hết giờ và đóng phòng ${fullSubRoomId}`,
                  );
                }
              }
            } catch (error) {
              console.error(
                `Lỗi khi auto-close phòng ${fullSubRoomId}:`,
                error,
              );
            }
          }, timeoutMs);

          currentTimers.push(roomTimer);
        }
      });

      // Lên lịch dọn dẹp metadata của Main Room khi phòng cuối cùng (dài nhất) kết thúc
      if (maxDuration > 0) {
        const cleanupTimeoutMs = maxDuration * 60 * 1000 + GRACE_PERIOD_MS;

        const cleanupTimer = setTimeout(async () => {
          try {
            const mainRooms = await this.livekitRoomService.listRooms([
              mainMeetingCode,
            ]);
            if (mainRooms.length > 0 && mainRooms[0].metadata) {
              const currentMeta: MainRoomMetadata = JSON.parse(
                mainRooms[0].metadata,
              );

              // ĐỐI CHIẾU THỜI GIAN: Chỉ dọn dẹp nếu session hiện tại trên LiveKit
              // khớp với session đã tạo cái setTimeout này (bảo vệ khi host kết thúc sớm và tạo phiên mới)
              if (
                currentMeta.breakoutSession &&
                currentMeta.breakoutSession.startedAt === sessionStartedAt
              ) {
                delete currentMeta.breakoutSession;

                await this.livekitRoomService.updateRoomMetadata(
                  mainMeetingCode,
                  JSON.stringify(currentMeta),
                );
                console.log(
                  `[Breakout] Đã dọn dẹp metadata phòng chính ${mainMeetingCode} sau khi toàn bộ phòng phụ kết thúc`,
                );
              }
            }
          } catch (error) {
            console.error(
              `Lỗi khi auto-clean phòng chính ${mainMeetingCode}:`,
              error,
            );
          }
        }, cleanupTimeoutMs);

        currentTimers.push(cleanupTimer);
      }

      if (currentTimers.length > 0) {
        this.breakoutTimers.set(mainMeetingCode, currentTimers);
      }
    } catch (error) {
      console.error("Lỗi khi tạo Breakout Session:", error);
      throw new AppException(ErrorCode.START_BREAKOUT_FAILED);
    }
  }

  /**
   * HOST: Kết thúc phiên Breakout
   * Xoá trạng thái breakout ở phòng chính và gửi tín hiệu 'closing' vào các phòng phụ
   */
  async endBreakoutSession(mainMeetingCode: string) {
    if (!this.livekitRoomService) return;

    try {
      this.clearTimersForMeeting(mainMeetingCode);
      // BƯỚC A: Cập nhật Metadata phòng chính về lại bình thường
      const mainRooms = await this.livekitRoomService.listRooms([
        mainMeetingCode,
      ]);
      let currentMeta: LivekitRoomMetadata = {} as LivekitRoomMetadata;

      if (mainRooms.length > 0 && mainRooms[0].metadata) {
        currentMeta = JSON.parse(mainRooms[0].metadata);
      }

      // Chỉ xử lý cho main room
      if (currentMeta.roomType === "breakout") return;

      // Lưu lại danh sách phòng để gửi tín hiệu đóng
      const breakoutRooms = currentMeta.breakoutSession?.rooms || [];

      // Xóa thông tin breakout khỏi metadata
      delete currentMeta.breakoutSession;
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
      throw new AppException(ErrorCode.END_BREAKOUT_FAILED);
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
        throw new AppException(
          ErrorCode.BREAKOUT_ROOM_NOT_FOUND_OR_CLOSED,
        );
      }

      if (subRooms[0].metadata) {
        const meta: LivekitRoomMetadata = JSON.parse(subRooms[0].metadata);

        // Kiểm tra chắc chắn đây là phòng breakout
        if (meta.roomType !== "breakout") {
          throw new AppException(
            ErrorCode.INVALID_BREAKOUT_ROOM,
          );
        }

        // (Tuỳ chọn) Kiểm tra thêm trạng thái phòng có đang active không
        if (meta.status !== "active") {
          throw new AppException(
            ErrorCode.BREAKOUT_ROOM_NOT_ACTIVE,
          );
        }
      } else {
        throw new AppException(ErrorCode.BREAKOUT_ROOM_DATA_INVALID);
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(ErrorCode.SERVER_ERROR);
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
        throw new AppException(
          ErrorCode.MUST_BE_IN_MAIN_ROOM,
        );
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(ErrorCode.MAIN_ROOM_NOT_ACTIVE);
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
        throw new AppException(
          ErrorCode.BREAKOUT_ROOM_NOT_FOUND_OR_CLOSED,
        );
      }

      if (subRooms[0].metadata) {
        const subMeta: LivekitRoomMetadata = JSON.parse(subRooms[0].metadata);
        if (subMeta.roomType !== "breakout") return;
        parentRoomCode = subMeta.parentRoom;
      }

      if (!parentRoomCode) {
        throw new AppException(
          ErrorCode.MAIN_ROOM_INFO_NOT_FOUND,
        );
      }
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(ErrorCode.SERVER_ERROR);
    }

    // Xác thực xem User có đang ở trong Breakout này không
    const participants =
      await this.livekitRoomService.listParticipants(fullBreakoutRoomName);
    const isActuallyInBreakout = participants.some(
      (p) => p.identity === userId,
    );

    if (!isActuallyInBreakout) {
      throw new AppException(
        ErrorCode.NOT_IN_BREAKOUT_ROOM,
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
   * Lấy số lượng người tham gia trong từng phòng breakout
   */
  async getBreakoutRoomsParticipantCount(
    mainMeetingCode: string,
  ): Promise<{ counts: Record<string, number>; serverTime: number }> {
    const serverTime = Date.now(); // Lấy giờ chuẩn xác từ Server
    if (!this.livekitRoomService) return { counts: {}, serverTime };

    try {
      // 1. Lấy metadata của phòng chính để biết danh sách các phòng breakout đang mở
      const mainRooms = await this.livekitRoomService.listRooms([
        mainMeetingCode,
      ]);
      if (mainRooms.length === 0 || !mainRooms[0].metadata)
        return { counts: {}, serverTime };

      const currentMeta: LivekitRoomMetadata = JSON.parse(
        mainRooms[0].metadata,
      );

      if (currentMeta.roomType !== "main") return;

      const breakoutRooms: LivekitBreakoutRoom[] =
        currentMeta.breakoutSession?.rooms || [];

      if (breakoutRooms.length === 0) return { counts: {}, serverTime };

      // 2. Tạo mảng tên các phòng phụ (full ID) để truy vấn LiveKit
      const subRoomNames = breakoutRooms.map(
        (room) => `${mainMeetingCode}_${room.id}`,
      );

      // 3. Lấy thông tin các phòng phụ đang hoạt động
      const activeSubRooms =
        await this.livekitRoomService.listRooms(subRoomNames);

      const counts: Record<string, number> = {};

      // Khởi tạo tất cả số lượng ban đầu là 0
      breakoutRooms.forEach((room) => {
        counts[room.id] = 0;
      });

      // Cập nhật số lượng thực tế từ LiveKit trả về
      activeSubRooms.forEach((subRoom) => {
        // Cắt bỏ phần mainMeetingCode_ để lấy lại subRoomId (vd: sub_1)
        const subId = subRoom.name.replace(`${mainMeetingCode}_`, "");
        counts[subId] = subRoom.numParticipants;
      });

      return { counts, serverTime };
    } catch (error) {
      console.error("Lỗi khi đếm số lượng người phòng breakout:", error);
      return { counts: {}, serverTime };
    }
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
