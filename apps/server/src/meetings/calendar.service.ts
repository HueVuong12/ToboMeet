import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CalendarEvent, CalendarEventDocument } from "./schemas/calendar-event.schema";
import { MeetingInvitation, MeetingInvitationDocument } from "./schemas/meeting-invitation.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { RRule, rrulestr } from "rrule";
import { AppGateway } from "../core/gateways/app.gateway";
import * as nodemailer from "nodemailer";

@Injectable()
export class CalendarService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEventDocument>,
    @InjectModel(MeetingInvitation.name) private meetingInvitationModel: Model<MeetingInvitationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
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
      roomType?: "meeting" | "classroom";
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
    if (data.channelId) {
      this.appGateway.server.to(data.channelId).emit("channel_calendar_event_created", event);
    }

    return { event, invitations };
  }

  /**
   * Truy vấn lịch họp theo khoảng thời gian và sinh chuỗi lặp ảo
   */
  async getEventsForUser(userId: string, startRange: string, endRange: string, filters?: { roomId?: string; createdByMe?: boolean }) {
    const rangeStart = new Date(startRange);
    const rangeEnd = new Date(endRange);

    // 1. Tìm các cuộc họp do user tổ chức hoặc được mời
    let query: any = {};

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
          const rule = rrulestr(event.recurrenceRule, { dtstart: event.startDate });
          const occurrences = rule.between(rangeStart, rangeEnd, true);

          const duration = event.endDate.getTime() - event.startDate.getTime();

          for (const occ of occurrences) {
            const dateStr = occ.toISOString().substring(0, 10);
            
            // Bỏ qua nếu ngày này nằm trong danh sách ngoại lệ (bị hủy)
            if (event.recurrenceExceptions?.includes(dateStr)) {
              continue;
            }

            const occStart = occ;
            const occEnd = new Date(occ.getTime() + duration);

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

    return resultEvents;
  }

  /**
   * Cập nhật lịch họp (Chỉ lần này / Toàn chuỗi)
   */
  async updateEvent(
    userId: string,
    eventId: string,
    updateType: "single" | "all",
    data: any,
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
