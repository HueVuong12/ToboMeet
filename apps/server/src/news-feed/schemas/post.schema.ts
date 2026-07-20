import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true, index: true })
  channelId: string;

  @Prop({ required: true, index: true })
  authorId: string; // Supabase User ID

  @Prop({ required: true })
  content: string;

  @Prop({
    type: [
      {
        url: { type: String, required: true },
        fileName: { type: String, required: true },
        fileType: { type: String, required: true }, // 'image' | 'video' | 'file'
        fileSize: { type: Number, required: true },
        thumbnail: { type: String, default: "" },
      },
    ],
    default: [],
  })
  attachments: {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    thumbnail?: string;
  }[];

  @Prop({
    type: [
      {
        userId: { type: String, required: true },
        reaction: { type: String, required: true }, // 'like', 'heart', 'laugh', etc.
        reactedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reactions: {
    userId: string;
    reaction: string;
    reactedAt: Date;
  }[];

  @Prop({ type: Boolean, default: false })
  isEdited: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
