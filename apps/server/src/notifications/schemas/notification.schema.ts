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

  // Lưu trữ dữ liệu ngữ cảnh thô (Không chứa văn bản hiển thị)
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
