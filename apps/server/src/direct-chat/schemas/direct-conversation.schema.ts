import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type DirectConversationDocument = DirectConversation & Document;

@Schema({ timestamps: true })
export class DirectConversation {
  // Luôn lưu sorted [min, max] để tránh tạo duplicate conversation
  @Prop({ type: [String], required: true, index: true })
  participantIds: string[];

  @Prop({ default: null })
  lastMessageAt: Date | null;

  @Prop({ default: "" })
  lastMessagePreview: string;

  // Map userId -> số tin nhắn chưa đọc
  @Prop({ type: Map, of: Number, default: {} })
  unreadCounts: Map<string, number>;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const DirectConversationSchema =
  SchemaFactory.createForClass(DirectConversation);

// Index compound để tìm nhanh conversation giữa 2 người
DirectConversationSchema.index({ participantIds: 1 }, { unique: true });
DirectConversationSchema.index({ participantIds: 1, lastMessageAt: -1 });
