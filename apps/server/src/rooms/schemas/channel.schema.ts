import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { ChannelMember, ChannelMemberSchema } from "./channel-member.schema";

@Schema({ _id: true, timestamps: false })
export class Channel {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Boolean, default: false })
  isPrivate?: boolean;

  @Prop({ type: [ChannelMemberSchema] })
  members?: ChannelMember[];

  /**
   * Danh sách userId đã rời khỏi kênh công khai (public channel).
   * Kênh riêng tư (private) dùng hard-delete trên members[].
   */
  @Prop({ type: [String], default: [] })
  leftMemberIds?: string[];

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
