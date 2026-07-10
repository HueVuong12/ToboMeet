import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Channel, ChannelSchema } from "./channel.schema";
import { RoomMember, RoomMemberSchema } from "./room-member.schema";

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

  @Prop({ type: [RoomMemberSchema], default: [] })
  members: RoomMember[];

  @Prop({ type: [ChannelSchema], default: [] })
  channels: Channel[];

  @Prop({ type: Boolean, default: false })
  isDeleted?: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
