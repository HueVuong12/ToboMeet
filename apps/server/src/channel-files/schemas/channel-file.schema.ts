import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ChannelFileDocument = ChannelFile & Document;

@Schema({ timestamps: true })
export class ChannelFile {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true, index: true })
  channelId: string;

  @Prop({ required: true })
  uploadedBy: string; // supabaseId

  @Prop({ required: true })
  uploadedByName: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: false })
  storagePath?: string;

  @Prop({ required: false })
  publicUrl?: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ default: false, index: true })
  isFolder: boolean;

  @Prop({ type: String, default: null, index: true })
  parentFolderId: string | null;
}

export const ChannelFileSchema = SchemaFactory.createForClass(ChannelFile);
