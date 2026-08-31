// src/meetings/schemas/meeting-session.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type MeetingSessionDocument = MeetingSession & Document;

@Schema({ timestamps: true })
export class MeetingSession {
  @Prop({ required: true, index: true })
  meetingCode: string;

  @Prop({ required: true, enum: ["ongoing", "ended"], default: "ongoing" })
  status: string;

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop()
  endedAt?: Date;
}

export const MeetingSessionSchema =
  SchemaFactory.createForClass(MeetingSession);

// Partial Unique Index
// Đảm bảo chỉ có 1 phiên 'ongoing' duy nhất tồn tại tại 1 thời điểm cho 1 mã phòng
MeetingSessionSchema.index(
  { meetingCode: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ongoing" } },
);
