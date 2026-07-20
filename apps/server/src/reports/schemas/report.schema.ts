import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ReportDocument = Report & Document;

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

@Schema({ _id: false })
export class Evidence {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ default: Date.now })
  uploadedAt?: Date;
}

@Schema({ _id: false })
export class RoomInfo {
  @Prop()
  roomId?: string;

  @Prop()
  roomName?: string;

  @Prop()
  roomCode?: string;

  @Prop()
  hostName?: string;

  @Prop()
  occurredAt?: Date;
}

@Schema({ _id: false })
export class AdminNote {
  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  adminId: string;

  @Prop({ required: true })
  adminEmail: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

@Schema({ _id: false })
export class ProcessingLogEntry {
  @Prop({ required: true })
  action: string; // e.g. "STATUS_CHANGED", "NOTE_ADDED", "CONCLUSION_SET"

  @Prop()
  fromStatus?: string;

  @Prop()
  toStatus?: string;

  @Prop({ required: true })
  adminId: string;

  @Prop({ required: true })
  adminEmail: string;

  @Prop()
  note?: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}

// ─── Main Schema ───────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true })
  reporterId: string; // Supabase ID of the reporter

  @Prop({ required: true })
  reportedUserId: string; // Supabase ID of the reported user

  @Prop()
  title?: string; // Optional title, can be auto-generated from reason

  @Prop({
    required: true,
    enum: [
      "Spam",
      "Quấy rối",
      "Ngôn từ xúc phạm",
      "Chia sẻ nội dung không phù hợp",
      "Mạo danh",
      "Khác",
    ],
  })
  reason: string;

  @Prop({ default: "" })
  description: string;

  @Prop({
    required: true,
    enum: ["PENDING", "INVESTIGATING", "RESOLVED", "REJECTED", "CLOSED"],
    default: "PENDING",
  })
  status: string;

  // Embedded room info (optional - report may happen outside a room)
  @Prop({ type: Object, default: null })
  roomInfo?: RoomInfo;

  // Evidence files
  @Prop({
    type: [
      {
        url: { type: String, required: true },
        fileName: { type: String, required: true },
        fileSize: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  evidences?: {
    url: string;
    fileName: string;
    fileSize: number;
    uploadedAt?: Date;
  }[];

  // Admin internal notes (only admins can see)
  @Prop({
    type: [
      {
        content: { type: String, required: true },
        adminId: { type: String, required: true },
        adminEmail: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  adminNotes?: {
    content: string;
    adminId: string;
    adminEmail: string;
    createdAt: Date;
  }[];

  // Processing log / timeline
  @Prop({
    type: [
      {
        action: { type: String, required: true },
        fromStatus: { type: String },
        toStatus: { type: String },
        adminId: { type: String, required: true },
        adminEmail: { type: String, required: true },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  processingLog?: {
    action: string;
    fromStatus?: string;
    toStatus?: string;
    adminId: string;
    adminEmail: string;
    note?: string;
    timestamp: Date;
  }[];

  // Admin conclusion
  @Prop({
    enum: ["VIOLATED", "NOT_VIOLATED", "INSUFFICIENT_EVIDENCE", null],
    default: null,
  })
  conclusion?: string | null;

  @Prop({ default: null })
  resolvedAt?: Date;

  @Prop({ default: null })
  closedAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// Index for efficient queries
ReportSchema.index({ status: 1 });
ReportSchema.index({ reporterId: 1 });
ReportSchema.index({ reportedUserId: 1 });
ReportSchema.index({ createdAt: -1 });
