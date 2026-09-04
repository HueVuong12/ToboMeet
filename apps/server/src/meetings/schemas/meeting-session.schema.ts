// src/meetings/schemas/meeting-session.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import * as crypto from "crypto";

@Schema({ _id: false, timestamps: true })
export class SessionRecording {
  @Prop({ required: true, default: () => crypto.randomUUID() })
  recordingId: string;

  @Prop({ required: true })
  folderName: string;

  @Prop({ required: true })
  storagePath: string;

  @Prop()
  playlistUrl?: string;

  @Prop({ default: 0 })
  durationSeconds: number;

  @Prop({ default: 0 })
  sizeBytes: number;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const SessionRecordingSchema =
  SchemaFactory.createForClass(SessionRecording);

export type MeetingSessionDocument = MeetingSession & Document;

@Schema({ timestamps: true })
export class MeetingSession {
  @Prop({ required: true, index: true })
  meetingCode: string;

  @Prop({ required: true, enum: ["ongoing", "ended"], default: "ongoing" })
  status: string;

  @Prop({ default: () => `session_${crypto.randomUUID()}` })
  sessionFolder: string;

  @Prop({ type: [SessionRecordingSchema], default: [] })
  recordings: SessionRecording[];

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

