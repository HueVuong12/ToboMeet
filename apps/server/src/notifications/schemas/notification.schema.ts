// src/notifications/schemas/notification.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  type: string; // 'KICKED', 'ROOM_DISBANDED', 'NEW_MESSAGE', v.v...

  // Thuộc tính đa hình dùng làm khóa tra cứu (VD: lưu meetingCode khi là MEETING_INVITE)
  @Prop()
  referenceId: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: false })
  isNotified: boolean; // Dành cho Popup/Toast

  @Prop({ default: false })
  canPopup: boolean; // Cho phép thông báo này được popup

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, type: 1, referenceId: 1 });
