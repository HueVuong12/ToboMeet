// src/meetings/schemas/meeting.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type MeetingDocument = Meeting & Document;

@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true, index: true })
  roomId: string; // Thuộc phòng lớn nào

  @Prop({ required: true, index: true })
  channelId: string;

  @Prop({ required: true, unique: true })
  meetingCode: string; // Mã định danh phòng LiveKit (ví dụ: meet-abc123x)

  @Prop({ required: true, enum: ["ongoing", "ended"], default: "ongoing" })
  status: string; // Trạng thái cuộc họp

  @Prop({ required: true })
  hostId: string; // Người khởi tạo cuộc họp
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);
// Cài đặt index hợp hợp để query theo cặp roomId và channelName cực nhanh
MeetingSchema.index({ roomId: 1, channelName: 1, status: 1 });
