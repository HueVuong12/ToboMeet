import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ReportDocument = Report & Document;

@Schema({ timestamps: true })
export class Report {
  @Prop({ required: true })
  reporterId: string; // Supabase ID of the reporter

  @Prop({ required: true })
  reportedUserId: string; // Supabase ID of the reported user

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
    enum: ["PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED"],
    default: "PENDING",
  })
  status: string;

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
}

export const ReportSchema = SchemaFactory.createForClass(Report);
