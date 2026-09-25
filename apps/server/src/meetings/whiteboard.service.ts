// src/meetings/whiteboard.service.ts
import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as jwt from "jsonwebtoken";
import { Meeting, MeetingDocument } from "./schemas/meeting.schema";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import {
  ErrorCode,
  WhiteboardAccessResponse,
  WhiteboardAccessRole,
  WhiteboardPermissionLevel,
  WhiteboardSettings,
} from "@tobomeet/shared/types";
import { AppException } from "../core/exceptions/app.exception";
import { MeetingsService } from "./meetings.service";

@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  constructor(
    @InjectModel(Meeting.name)
    private readonly meetingModel: Model<MeetingDocument>,
    @InjectModel(Room.name)
    private readonly roomModel: Model<RoomDocument>,
    @Inject(forwardRef(() => MeetingsService))
    private readonly meetingsService: MeetingsService,
  ) {}

  /**
   * Cập nhật cấu hình phân quyền Whiteboard
   */
  async updateWhiteboardSettings(
    meetingCode: string,
    settings: WhiteboardSettings,
  ): Promise<WhiteboardSettings> {
    // Đảm bảo admin luôn có trong allowedRoles
    const sanitizedRoles = Array.from(
      new Set(["admin", ...(settings.allowedRoles || [])]),
    ) as WhiteboardAccessRole[];

    const sanitizedSettings: WhiteboardSettings = {
      allowedRoles: sanitizedRoles,
      memberPermission: settings.memberPermission === "view" ? "view" : "edit",
      guestPermission: settings.guestPermission === "view" ? "view" : "edit",
    };

    // 1. Cập nhật MongoDB meeting
    await this.meetingModel
      .updateOne(
        { meetingCode },
        { $set: { whiteboardSettings: sanitizedSettings } },
      )
      .exec();

    // 2. Cập nhật TLDocument.meta trên Whiteboard Sync Server
    try {
      const whiteboardHttpUrl = (
        process.env.WHITEBOARD_HTTP_URL ||
        process.env.WHITEBOARD_SERVER_URL ||
        "http://localhost:3002"
      )
        .replace(/^ws:\/\//, "http://")
        .replace(/^wss:\/\//, "https://")
        .replace(/\/sync\/?$/, "")
        .replace(/\/$/, "");

      const response = await fetch(
        `${whiteboardHttpUrl}/rooms/${encodeURIComponent(meetingCode)}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: sanitizedSettings }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `[Whiteboard Sync] Failed to update settings on whiteboard server: status ${response.status}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `[Whiteboard Sync] Cannot reach whiteboard server: ${err?.message}`,
      );
    }

    return sanitizedSettings;
  }

  /**
   * Lấy cấu hình phân quyền Whiteboard của cuộc họp
   */
  async getWhiteboardSettings(meetingCode: string): Promise<WhiteboardSettings> {
    const meeting = await this.meetingModel
      .findOne({ meetingCode })
      .select("whiteboardSettings")
      .lean();

    return (
      meeting?.whiteboardSettings || {
        allowedRoles: ["admin", "member", "guest"],
        memberPermission: "edit",
        guestPermission: "edit",
      }
    );
  }

  /**
   * Đánh giá quyền truy cập Whiteboard của người dùng đối với một cuộc họp
   */
  async evaluateWhiteboardAccess(
    meeting: MeetingDocument,
    userId: string,
  ): Promise<WhiteboardAccessResponse> {
    const { role, hasAdminPowers } =
      await this.meetingsService.resolveParticipantRole(meeting, userId);

    const whiteboardSettings: WhiteboardSettings = meeting.whiteboardSettings || {
      allowedRoles: ["admin", "member", "guest"],
      memberPermission: "edit",
      guestPermission: "edit",
    };

    let canAccess = false;
    let isReadOnly = false;

    if (hasAdminPowers || role === "owner" || role === "admin") {
      canAccess = true;
      isReadOnly = false;
    } else if (role === "member") {
      canAccess = whiteboardSettings.allowedRoles.includes("member");
      isReadOnly = whiteboardSettings.memberPermission === "view";
    } else {
      canAccess = whiteboardSettings.allowedRoles.includes("guest");
      isReadOnly = whiteboardSettings.guestPermission === "view";
    }

    const permission: WhiteboardPermissionLevel = isReadOnly ? "view" : "edit";

    return {
      canAccess,
      role: (hasAdminPowers ? (role === "owner" ? "owner" : "admin") : role) as
        | "owner"
        | "admin"
        | "member"
        | "guest",
      hasAdminPowers: hasAdminPowers || role === "owner" || role === "admin",
      permission,
      isReadOnly,
    };
  }

  /**
   * Kiểm tra quyền truy cập Whiteboard của người dùng theo mã cuộc họp (meetingCode)
   */
  async checkWhiteboardAccess(
    meetingCode: string,
    userId: string,
  ): Promise<WhiteboardAccessResponse> {
    const meeting = await this.meetingModel.findOne({ meetingCode }).exec();
    if (!meeting) {
      throw new AppException(ErrorCode.MEETING_NOT_FOUND);
    }

    return this.evaluateWhiteboardAccess(meeting, userId);
  }

  /**
   * Kiểm tra quyền truy cập Whiteboard của người dùng theo kênh (roomId & channelId)
   */
  async checkChannelWhiteboardAccess(
    roomId: string,
    channelId: string,
    userId: string,
  ): Promise<WhiteboardAccessResponse> {
    const meeting = await this.meetingModel
      .findOne({ roomId, channelId, type: "channel" })
      .exec();

    if (!meeting) {
      const room = await this.roomModel.findById(roomId).exec();
      if (!room) {
        throw new AppException(ErrorCode.ROOM_OR_CHANNEL_NOT_FOUND);
      }
      const role = this.meetingsService.getUserRoleInChannel(
        room,
        channelId,
        userId,
      );
      const hasAdminPowers = role === "owner" || role === "admin";
      const canAccess =
        hasAdminPowers || role === "member" || role === "guest";
      return {
        canAccess,
        role: (hasAdminPowers ? (role === "owner" ? "owner" : "admin") : role) as
          | "owner"
          | "admin"
          | "member"
          | "guest",
        hasAdminPowers,
        permission: "edit",
        isReadOnly: false,
      };
    }

    return this.evaluateWhiteboardAccess(meeting, userId);
  }

  /**
   * Tạo Whiteboard Token (RS256) cho người dùng có quyền trong cuộc họp
   */
  async generateWhiteboardToken(
    meetingCode: string,
    userId: string,
    displayName?: string,
  ): Promise<{
    token: string;
    roomId: string;
    whiteboardUrl: string;
    user?: { id: string; name: string; avatarUrl?: string };
  }> {
    // Tìm meeting & xác định quyền người dùng trong cuộc họp
    const meeting = await this.meetingModel.findOne({ meetingCode }).exec();
    if (!meeting) {
      throw new AppException(ErrorCode.MEETING_NOT_FOUND);
    }

    // Kiểm tra phân quyền truy cập Whiteboard
    const access = await this.evaluateWhiteboardAccess(meeting, userId);
    if (!access.canAccess) {
      throw new AppException(ErrorCode.INVALID_PERMISSION);
    }

    const finalDisplayName = displayName?.trim() || "Người dùng";

    const rawPrivateKey = process.env.WHITEBOARD_PRIVATE_KEY;
    if (!rawPrivateKey) {
      throw new AppException(ErrorCode.SERVER_ERROR);
    }
    const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

    const userRole = access.hasAdminPowers ? "admin" : access.role || "guest";
    const payload = {
      sub: userId,
      role: userRole,
      meetingCode,
      roomId: meetingCode,
      displayName: finalDisplayName,
      isReadOnly: access.isReadOnly,
      iss: "tobomeet-server",
      aud: "tobomeet-whiteboard",
    };

    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      expiresIn: "5m",
    });

    const whiteboardUrl =
      process.env.WHITEBOARD_SERVER_URL || "ws://localhost:3002/sync";

    return {
      token,
      roomId: meetingCode,
      whiteboardUrl,
      user: {
        id: userId,
        name: finalDisplayName,
        avatarUrl: "",
      },
    };
  }
}
