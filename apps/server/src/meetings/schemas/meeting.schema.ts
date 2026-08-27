// src/meetings/schemas/meeting.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type MeetingDocument = Meeting & Document;

export type MeetingType = "channel" | "personal";

@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true, unique: true })
  meetingCode: string;

  @Prop({ required: true, enum: ["channel", "personal"], default: "channel" })
  type: MeetingType;

  // ===== Channel Meeting =====
  @Prop({ index: true })
  roomId?: string;

  @Prop({ index: true })
  channelId?: string;

  // ===== Personal Meeting =====
  @Prop({ index: true })
  ownerId?: string; // userId của chủ meeting (chỉ dùng khi type = "personal")
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);

// Index cho channel meeting
MeetingSchema.index(
  { roomId: 1, channelId: 1 },
  { unique: true, partialFilterExpression: { type: "channel" } },
);

// Index cho personal meeting (mỗi user chỉ có 1 personal meeting)
MeetingSchema.index(
  { ownerId: 1 },
  { unique: true, partialFilterExpression: { type: "personal" } },
);