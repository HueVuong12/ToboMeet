import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type RoomReportDocument = RoomReport & Document;

@Schema({ _id: false })
export class RoomReportEvidence {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ default: Date.now })
  uploadedAt?: Date;
}

@Schema({ timestamps: true })
export class RoomReport {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true })
  roomName: string;

  @Prop({ required: true })
  roomOwner: string; // Supabase ID of the owner of the room

  @Prop({ required: true })
  reporterId: string;

  @Prop({
    required: true,
    enum: [
      "Quấy rối",
      "Spam",
      "Nội dung phản cảm",
      "Lừa đảo",
      "Chia sẻ thông tin sai sự thật",
      "Vi phạm bản quyền",
      "Khác",
    ],
  })
  reason: string;

  @Prop({ default: "" })
  description: string;

  @Prop({ type: [RoomReportEvidence], default: [] })
  attachments: RoomReportEvidence[];

  @Prop({
    required: true,
    enum: ["PENDING", "REVIEWING", "RESOLVED", "REJECTED"],
    default: "PENDING",
  })
  status: string;

  @Prop({ type: [Object], default: [] })
  processingLog: any[];

  @Prop({ type: [Object], default: [] })
  adminNotes: any[];
}

export const RoomReportSchema = SchemaFactory.createForClass(RoomReport);

// Index để truy vấn nhanh và chống spam
RoomReportSchema.index({ roomId: 1, reporterId: 1 }, { unique: true });
RoomReportSchema.index({ status: 1 });
RoomReportSchema.index({ createdAt: -1 });
