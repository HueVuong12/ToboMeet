// src/meetings/meetings.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Meeting, MeetingDocument } from "./schemas/meeting.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { AccessToken } from "livekit-server-sdk";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { MeetingJoinResponse } from "@tobomeet/shared/types";

@Injectable()
export class MeetingsService {
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

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

    // Tìm thông tin tên hiển thị của User để làm Identity trong LiveKit
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

    // Nếu CHƯA CÓ cuộc họp nào, tiến hành tạo mới (Bắt đầu cuộc họp)
    if (!meeting) {
      const randomString = Math.random().toString(36).substring(2, 9);
      meeting = await this.meetingModel.create({
        roomId,
        channelId,
        meetingCode: `meet-${roomId.substring(0, 4)}-${randomString}`,
        status: "ongoing",
        hostId: userId,
      });
    }

    // 4. Sinh LiveKit Access Token (Vé thông hành) cho người dùng này
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
    });

    return {
      token: await at.toJwt(),
      meetingCode: meeting.meetingCode,
      status: meeting.status,
      isHost: meeting.hostId === userId,
    };
  }

  /**
   * Kết thúc cuộc họp — Chuyển trạng thái sang 'ended' để giải phóng kênh
   */
  async endMeeting(roomId: string, channelId: string) {
    const meeting = await this.meetingModel
      .findOne({
        roomId,
        channelId,
        status: "ongoing",
      })
      .exec();

    if (!meeting) {
      throw new NotFoundException(
        "Không tìm thấy cuộc họp nào đang diễn ra trong kênh này",
      );
    }

    meeting.status = "ended";
    await meeting.save();

    return { message: "Cuộc họp đã được kết thúc thành công" };
  }
}
