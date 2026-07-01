import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: true, timestamps: false })
export class Channel {
  @Prop({ required: true })
  name: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
