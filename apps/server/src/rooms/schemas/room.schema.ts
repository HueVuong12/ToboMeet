import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

// ─── Channel (embedded sub-document) ─────────────────────────────────────────
@Schema({ _id: true, timestamps: false })
export class Channel {
  @Prop({ required: true })
  name: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);

// ─── Room ────────────────────────────────────────────────────────────────────
export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ["meeting", "classroom"] })
  type: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  ownerId: string;

  @Prop({ type: [String], default: [] })
  members: string[];

  @Prop({ type: [ChannelSchema], default: [] })
  channels: Channel[];
}

export const RoomSchema = SchemaFactory.createForClass(Room);
