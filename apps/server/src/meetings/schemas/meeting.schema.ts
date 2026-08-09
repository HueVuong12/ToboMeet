// src/meetings/schemas/meeting.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type MeetingDocument = Meeting & Document;

// Cuộc họp duy nhất cho cả kênh, có thể xoay vòng meetingCode trong tương lai
@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true, index: true })
  channelId: string;

  @Prop({ required: true, unique: true })
  meetingCode: string; // Mã định danh phòng LiveKit (ví dụ: meet-abc123x)

  @Prop({ required: true })
  hostId: string; // Người khởi tạo cuộc họp
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);
MeetingSchema.index({ roomId: 1, channelId: 1 });
