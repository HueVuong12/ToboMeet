import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type UserPinnedFileDocument = UserPinnedFile & Document;

@Schema({ timestamps: true })
export class UserPinnedFile {
  @Prop({ required: true, index: true })
  userId: string; // supabaseId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "ChannelFile", required: true, index: true })
  fileId: any;

  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true, index: true })
  channelId: string;
}

export const UserPinnedFileSchema = SchemaFactory.createForClass(UserPinnedFile);

// Index composite to prevent duplicate user-file pinning
UserPinnedFileSchema.index({ userId: 1, fileId: 1 }, { unique: true });
