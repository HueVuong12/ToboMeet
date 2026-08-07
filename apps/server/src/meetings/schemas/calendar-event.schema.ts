import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type CalendarEventDocument = CalendarEvent & Document;

@Schema({ timestamps: true })
export class CalendarEvent {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true, index: true })
  hostId: string; // UserId (Supabase ID hoặc ID người tổ chức)

  @Prop({ index: true })
  roomId: string; // Tùy chọn: Nhóm (Room) nếu tạo trong nhóm

  @Prop({ index: true })
  channelId: string; // Tùy chọn: Kênh (Channel) nếu tạo trong kênh

  @Prop({ default: "meeting" })
  roomType: "meeting" | "classroom"; // Loại phòng họp hoặc phòng học

  @Prop({ required: true })
  startDate: Date; // Thời gian bắt đầu (buổi đầu tiên nếu lặp)

  @Prop({ required: true })
  endDate: Date; // Thời gian kết thúc (buổi đầu tiên nếu lặp)

  @Prop({ default: "UTC" })
  timezone: string; // Múi giờ

  @Prop()
  location: string; // Địa điểm vật lý (nếu có)

  @Prop({ required: true, unique: true })
  meetingCode: string; // LiveKit Room Code

  @Prop()
  meetingPassword?: string; // Mật khẩu phòng họp (nếu có)

  // RFC 5545 Recurrence Rule: Ví dụ "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261231T235959Z"
  @Prop()
  recurrenceRule?: string;

  // Danh sách các ngày ngoại lệ (ví dụ: ngày bị hủy hoặc chỉnh sửa riêng biệt trong chuỗi lặp)
  // Lưu dạng chuỗi YYYYMMDD hoặc ISO Date string
  @Prop({ type: [String], default: [] })
  recurrenceExceptions: string[];
}

export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);
CalendarEventSchema.index({ startDate: 1, endDate: 1 });
CalendarEventSchema.index({ roomId: 1, channelId: 1 });
