import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type MeetingInvitationDocument = MeetingInvitation & Document;

@Schema({ timestamps: true })
export class MeetingInvitation {
  @Prop({ required: true, index: true })
  eventId: string; // Liên kết với CalendarEvent ID

  @Prop({ required: true, index: true })
  userId: string; // ID người dùng được mời

  @Prop({ required: true })
  email: string;

  @Prop()
  displayName: string;

  @Prop()
  avatarUrl: string;

  @Prop({
    required: true,
    enum: ["PENDING", "ACCEPTED", "DECLINED", "TENTATIVE"],
    default: "PENDING",
  })
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

  @Prop()
  reminderMinutesBefore?: number; // Ví dụ: 5, 10, 15, 30, 60
}

export const MeetingInvitationSchema = SchemaFactory.createForClass(MeetingInvitation);
MeetingInvitationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
