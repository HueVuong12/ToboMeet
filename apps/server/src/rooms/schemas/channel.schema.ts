import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ _id: true, timestamps: false })
export class Channel {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
