import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { CalendarEvent, CalendarEventDocument } from "./schemas/calendar-event.schema";
import { MeetingInvitation, MeetingInvitationDocument } from "./schemas/meeting-invitation.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { rrulestr } from "rrule";
import { AppGateway } from "../core/gateways/app.gateway";
import * as nodemailer from "nodemailer";
import { UpdateEventDto } from "./dto/update-event.dto";

@Injectable()
export class CalendarService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEventDocument>,
    @InjectModel(MeetingInvitation.name) private meetingInvitationModel: Model<MeetingInvitationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @InjectModel("Post") private postModel: Model<any>,
    private readonly appGateway: AppGateway,
  ) {
    // Khởi tạo mail transporter từ SMTP Env
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  /**
   * Tạo lịch họp mới
   */
  async createEvent(
    userId: string,
    data: {
      title: string;
      description?: string;
      roomId?: string;
      channelId?: string;
      roomType?: "meeting" | "classroom" | "channel_meeting";
      startDate: string;
      endDate: string;
      timezone?: string;
      location?: string;
      meetingPassword?: string;
      recurrenceRule?: string;
      invitees?: { email: string; userId?: string }[];
    },
  ) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    const now = new Date();
    if (start <= now) {
      throw new BadRequestException("Thời gian bắt đầu họp phải sau thời gian hiện tại");
    }

    if (start >= end) {
      throw new BadRequestException("Thời gian bắt đầu phải trước thời gian kết thúc");
    }

    // Validate dữ liệu riêng cho cuộc họp kênh (channel_meeting)
    if (data.roomType === "channel_meeting") {
      if (!data.roomId || !data.channelId) {
        throw new BadRequestException(
          "Cuộc họp kênh yêu cầu phải chọn phòng và kênh.",
        );
      }
      // Kiểm tra channelId phải thuộc roomId đã chọn
      const room = await this.roomModel.findOne({
        _id: data.roomId,
        isDeleted: { $ne: true },
      });
      if (!room) {
        throw new BadRequestException(
          "Phòng không tồn tại hoặc đã bị giải tán.",
        );
      }
      const channelExists = room.channels.some(
        (ch) => ch._id?.toString() === data.channelId,
      );
      if (!channelExists) {
        throw new BadRequestException(
          "Kênh không thuộc phòng đã chọn. Dữ liệu không hợp lệ.",
        );
      }
    }

    // Tự động sinh meeting code duy nhất
    const randomString = Math.random().toString(36).substring(2, 9);
    const meetingCode = `meet-${randomString}`;

    // Kiểm tra conflict lịch cho tất cả những người tham gia được mời
    if (data.invitees && data.invitees.length > 0) {
      const userIds = data.invitees.map((i) => i.userId).filter(Boolean);
      await this.checkConflicts(userIds, start, end);
    }

    // Tạo Event mới
    const event = await this.calendarEventModel.create({
      ...data,
      hostId: userId,
      meetingCode,
      startDate: start,
      endDate: end,
    });

    // Mời các thành viên
    const invitations = [];
    if (data.invitees && data.invitees.length > 0) {
      for (const invitee of data.invitees) {
        let inviteeUser = null;
        if (invitee.userId) {
          inviteeUser = await this.userModel.findOne({ supabaseId: invitee.userId }).exec();
        } else {
          inviteeUser = await this.userModel.findOne({ email: invitee.email }).exec();
        }

        const invitation = await this.meetingInvitationModel.create({
          eventId: event._id.toString(),
          userId: inviteeUser ? inviteeUser.supabaseId : invitee.userId || "",
          email: invitee.email,
          displayName: inviteeUser ? inviteeUser.displayName : invitee.email,
          avatarUrl: inviteeUser ? inviteeUser.avatarUrl : "",
          status: "PENDING",
        });

        invitations.push(invitation);

        // Gửi thông báo WebSocket Realtime
        if (inviteeUser) {
          this.appGateway.server.to(`user_${inviteeUser.supabaseId}`).emit("calendar_event_received", {
            event,
            invitation,
          });
        }

        // Gửi Email thông báo qua SMTP
        this.sendEmailInvitation(invitee.email, event);
      }
    }

    // Nếu tạo trong Group/Channel, gửi cho mọi thành viên trong kênh qua Socket
    if (data.channelId && data.roomType === "channel_meeting" && data.roomId) {
      this.appGateway.server.to(data.channelId).emit("channel_calendar_event_created", event);
      
      // Tự động tạo meeting post trong bảng tin kênh
      try {
        const meetingPost = await this.postModel.create({
          roomId: data.roomId,
          channelId: data.channelId,
          authorId: userId,
          content: "Đã lên lịch cuộc họp",
          isMeeting: true,
          meetingId: event._id.toString(),
          meetingTitle: event.title,
          meetingStartDate: event.startDate,
          meetingEndDate: event.endDate,
          meetingCode: event.meetingCode,
          attachments: [],
          reactions: [],
          isEdited: false,
        });

        // Lấy thông tin user để emit realtime
        const authorUser = await this.userModel.findOne({ supabaseId: userId }).exec();
        const postWithAuthor = {
          ...meetingPost.toObject(),
          author: {
            userId: userId,
            displayName: authorUser?.displayName || authorUser?.email?.split('@')[0] || "Người dùng ẩn danh",
            avatarUrl: authorUser?.avatarUrl || "",
            role: "member",
          },
          commentsCount: 0,
          reactionStats: [],
          userReaction: null,
        };

        // Phát realtime qua Socket IO cho kênh bảng tin
        this.appGateway.server.to(`room_${data.roomId}`).emit("post_created", postWithAuthor);
      } catch (err) {
        console.error("Lỗi khi tự động tạo post lịch họp kênh:", err);
      }
    } else if (data.channelId) {
      this.appGateway.server.to(data.channelId).emit("channel_calendar_event_created", event);
    }

    // Phát event tạo lịch biểu realtime cho tất cả các client
    this.appGateway.server.emit("calendar_event_created", event);

    return { event, invitations };
  }

  /**
   * Truy vấn lịch họp theo khoảng thời gian và sinh chuỗi lặp ảo
   */
  async getEventsForUser(userId: string, startRange: string, endRange: string, filters?: { roomId?: string; createdByMe?: boolean }) {
    const rangeStart = new Date(startRange);
    const rangeEnd = new Date(endRange);

    // 1. Tìm các cuộc họp do user tổ chức hoặc được mời
    const query: Record<string, unknown> = {};

    if (filters?.roomId) {
      query.roomId = filters.roomId;
    } else {
      const myInvites = await this.meetingInvitationModel.find({ userId }).select("eventId").exec();
      const eventIds = myInvites.map((inv) => inv.eventId);
      
      if (filters?.createdByMe) {
        query.hostId = userId;
      } else {
        query.$or = [{ hostId: userId }, { _id: { $in: eventIds } }];
      }
    }

    const events = await this.calendarEventModel.find(query).exec();
    const resultEvents = [];

    for (const event of events) {
      if (!event.recurrenceRule) {
        // Sự kiện đơn lẻ thông thường
        if (event.startDate >= rangeStart && event.startDate <= rangeEnd) {
          resultEvents.push(event);
        }
      } else {
        // Sự kiện lặp chuẩn RFC 5545
        try {
          const offsetMs = 7 * 60 * 60 * 1000; // GMT+07:00 (Asia/Ho_Chi_Minh)
          const localStart = new Date(event.startDate.getTime() + offsetMs);
          const localRangeStart = new Date(rangeStart.getTime() + offsetMs);
          const localRangeEnd = new Date(rangeEnd.getTime() + offsetMs);

          const rule = rrulestr(event.recurrenceRule, { dtstart: localStart });
          const occurrences = rule.between(localRangeStart, localRangeEnd, true);

          const duration = event.endDate.getTime() - event.startDate.getTime();

          for (const occ of occurrences) {
            // occ.toISOString().substring(0, 10) sẽ là ngày theo múi giờ địa phương (do occ đã được dịch chuyển +7h)
            const dateStr = occ.toISOString().substring(0, 10);
            
            // Bỏ qua nếu ngày này nằm trong danh sách ngoại lệ (bị hủy)
            if (event.recurrenceExceptions?.includes(dateStr)) {
              continue;
            }

            const occStart = new Date(occ.getTime() - offsetMs);
            const occEnd = new Date(occStart.getTime() + duration);

            // Clone Event
            resultEvents.push({
              ...event.toObject(),
              startDate: occStart,
              endDate: occEnd,
              isOccurrence: true,
              occurrenceDate: dateStr,
            });
          }
        } catch (e) {
          console.error("Lỗi parse RRULE:", e);
        }
      }
    }

    // Đính kèm thông tin người tổ chức (hostEmail, hostDisplayName)
    const finalEvents = [];
    for (const e of resultEvents) {
      const hostUser = await this.userModel
        .findOne({ supabaseId: e.hostId })
        .select("email displayName avatarUrl")
        .exec();

      const eventObj = typeof e.toObject === "function" ? e.toObject() : e;
      finalEvents.push({
        ...eventObj,
        hostEmail: hostUser ? hostUser.email : "",
        hostDisplayName: hostUser ? (hostUser.displayName || hostUser.email.split('@')[0]) : "",
        hostAvatarUrl: hostUser ? hostUser.avatarUrl : "",
      });
    }

    return finalEvents;
  }

  /**
   * Cập nhật lịch họp (Chỉ lần này / Toàn chuỗi)
   */
  async updateEvent(
    userId: string,
    eventId: string,
    updateType: "single" | "all",
    data: Partial<UpdateEventDto>,
    occurrenceDate?: string,
  ) {
    const event = await this.calendarEventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException("Không tìm thấy sự kiện lịch họp");
    }

    // Kiểm tra quyền (Chỉ host mới có quyền sửa đổi)
    if (event.hostId !== userId) {
      throw new ForbiddenException("Bạn không có quyền sửa đổi lịch họp này");
    }

    if (updateType === "single" && event.recurrenceRule && occurrenceDate) {
      // 1. Chỉ chỉnh sửa 1 buổi đơn lẻ trong chuỗi lặp:
      // Thêm ngày hiện tại vào exceptions của chuỗi chính
      event.recurrenceExceptions.push(occurrenceDate);
      await event.save();

      // Tạo một CalendarEvent mới không lặp riêng biệt cho ngày này
      const originalStart = new Date(data.startDate);
      const originalEnd = new Date(data.endDate);
      
      const newEvent = await this.calendarEventModel.create({
        ...event.toObject(),
        _id: undefined,
        startDate: originalStart,
        endDate: originalEnd,
        recurrenceRule: undefined,
        recurrenceExceptions: [],
        title: data.title || event.title,
        description: data.description || event.description,
      });

      // Gửi realtime thông báo cho các bên liên quan
      this.appGateway.server.emit("calendar_event_updated", { eventId, updateType, event: newEvent });
      return newEvent;
    } else {
      // 2. Chỉnh sửa toàn bộ chuỗi
      const updatedEvent = await this.calendarEventModel.findByIdAndUpdate(
        eventId,
        { $set: data },
        { new: true },
      );

      // Cập nhật lại bài đăng meeting post nếu là cuộc họp kênh
      if (updatedEvent.roomType === "channel_meeting" && updatedEvent.roomId && updatedEvent.channelId) {
        try {
          const post = await this.postModel.findOneAndUpdate(
            { meetingId: eventId, isDeleted: { $ne: true } },
            {
              $set: {
                meetingTitle: updatedEvent.title,
                meetingStartDate: updatedEvent.startDate,
                meetingEndDate: updatedEvent.endDate,
              }
            },
            { new: true }
          );

          if (post) {
            // Lấy thông tin user để emit realtime
            const authorUser = await this.userModel.findOne({ supabaseId: post.authorId }).exec();
            const postWithAuthor = {
              ...post.toObject(),
              author: {
                userId: post.authorId,
                displayName: authorUser?.displayName || authorUser?.email?.split('@')[0] || "Người dùng ẩn danh",
                avatarUrl: authorUser?.avatarUrl || "",
                role: "member",
              },
            };
            this.appGateway.server.to(`room_${updatedEvent.roomId}`).emit("post_updated", postWithAuthor);
          }
        } catch (err) {
          console.error("Lỗi cập nhật post lịch họp:", err);
        }
      }

      this.appGateway.server.emit("calendar_event_updated", { eventId, updateType, event: updatedEvent });
      return updatedEvent;
    }
  }

  /**
   * Hủy lịch họp (Chỉ lần này / Toàn chuỗi)
   */
  async deleteEvent(userId: string, eventId: string, deleteType: "single" | "all", occurrenceDate?: string) {
    const event = await this.calendarEventModel.findById(eventId);
    if (!event) {
      throw new NotFoundException("Không tìm thấy sự kiện lịch họp");
    }

    if (event.hostId !== userId) {
      throw new ForbiddenException("Bạn không có quyền hủy lịch họp này");
    }

    // Xử lý xóa bài đăng cuộc họp kênh trong bảng tin
    if (event.roomType === "channel_meeting" && event.roomId && event.channelId) {
      try {
        const post = await this.postModel.findOneAndUpdate(
          { meetingId: eventId, isDeleted: { $ne: true } },
          { $set: { isDeleted: true } },
          { new: true }
        );
        if (post) {
          this.appGateway.server.to(`room_${event.roomId}`).emit("post_deleted", { postId: post._id });
        }
      } catch (err) {
        console.error("Lỗi xóa bài đăng lịch họp:", err);
      }
    }

    if (deleteType === "single" && event.recurrenceRule && occurrenceDate) {
      // Chỉ hủy buổi này: Thêm ngày hủy vào danh sách exceptions
      event.recurrenceExceptions.push(occurrenceDate);
      await event.save();

      this.appGateway.server.emit("calendar_event_deleted", { eventId, deleteType, occurrenceDate });
    } else {
      // Hủy toàn bộ chuỗi
      await this.calendarEventModel.findByIdAndDelete(eventId);
      await this.meetingInvitationModel.deleteMany({ eventId });

      this.appGateway.server.emit("calendar_event_deleted", { eventId, deleteType });
    }

    return { success: true };
  }

  /**
   * Phản hồi trạng thái RSVP
   */
  async updateRSVP(userId: string, eventId: string, status: "ACCEPTED" | "DECLINED" | "TENTATIVE") {
    const invite = await this.meetingInvitationModel.findOneAndUpdate(
      { eventId, userId },
      { $set: { status } },
      { new: true },
    );

    if (!invite) {
      throw new NotFoundException("Không tìm thấy lời mời tham gia lịch họp này");
    }

    // Phát sự kiện realtime về cho Host và các thành viên được mời
    const event = await this.calendarEventModel.findById(eventId);
    if (event) {
      this.appGateway.server.to(`user_${event.hostId}`).emit("rsvp_updated", { eventId, userId, status });
    }

    return invite;
  }

  /**
   * Lấy chi tiết RSVP của sự kiện
   */
  async getRSVPList(eventId: string) {
    return this.meetingInvitationModel.find({ eventId }).exec();
  }

  /**
   * Helper: Kiểm tra trùng lịch (Conflict Check)
   */
  private async checkConflicts(userIds: string[], start: Date, end: Date) {
    const conflicts = await this.meetingInvitationModel.find({
      userId: { $in: userIds },
      status: "ACCEPTED",
    }).exec();

    for (const conf of conflicts) {
      const event = await this.calendarEventModel.findById(conf.eventId);
      if (event) {
        // Kiểm tra chồng chéo thời gian
        if (
          (start >= event.startDate && start < event.endDate) ||
          (end > event.startDate && end <= event.endDate) ||
          (start <= event.startDate && end >= event.endDate)
        ) {
          const user = await this.userModel.findOne({ supabaseId: conf.userId }).exec();
          throw new BadRequestException(`Thành viên ${user?.displayName || conf.userId} đã bận lịch họp khác vào khung giờ này`);
        }
      }
    }
  }

  /**
   * Tìm kiếm sự kiện của người dùng theo từ khóa (gần đúng, không phân biệt hoa thường)
   */
  async searchEvents(userId: string, queryText: string) {
    if (!queryText || queryText.trim() === "") {
      return [];
    }

    const trimmedQuery = queryText.trim();

    // Query toàn bộ sự kiện có title hoặc description chứa keyword (Global Search)
    const query: Record<string, unknown> = {
      $or: [
        { title: { $regex: trimmedQuery, $options: "i" } }
      ]
    };

    // Chỉ select những trường phục vụ Search UI và giới hạn tối đa 10 kết quả
    const events = await this.calendarEventModel
      .find(query)
      .select("_id title startDate endDate roomType hostId")
      .sort({ startDate: -1 })
      .limit(10)
      .exec();

    // Đính kèm nhanh email host (chỉ select email từ userModel)
    const results = [];
    for (const event of events) {
      const hostUser = await this.userModel
        .findOne({ supabaseId: event.hostId })
        .select("email")
        .exec();
      results.push({
        ...event.toObject(),
        hostEmail: hostUser ? hostUser.email : "",
      });
    }
    return results;
  }

  /**
   * Helper: Gửi thư mời qua SMTP Email
   */
  private async sendEmailInvitation(email: string, event: CalendarEvent) {
    if (!this.transporter) return;

    try {
      const from = process.env.SMTP_FROM || `"ToboMeet Calendar" <${process.env.SMTP_USER}>`;
      await this.transporter.sendMail({
        from,
        to: email,
        subject: `[ToboMeet] Lời mời họp: ${event.title}`,
        html: `
          <h3>Bạn nhận được lời mời tham gia cuộc họp trên ToboMeet</h3>
          <p><strong>Tiêu đề:</strong> ${event.title}</p>
          <p><strong>Bắt đầu:</strong> ${event.startDate.toLocaleString()}</p>
          <p><strong>Mô tả:</strong> ${event.description || "Không có mô tả"}</p>
          <p><strong>Mã cuộc họp Livekit:</strong> ${event.meetingCode}</p>
          <hr />
          <p>Vui lòng đăng nhập hệ thống ToboMeet để phản hồi lời mời.</p>
        `,
      });
    } catch (e) {
      console.error("Lỗi gửi email mời họp:", e);
    }
  }
}
