import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class ChannelMember {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, default: "member" })
  role: string;

  @Prop({ type: Boolean, default: false })
  isLeft?: boolean;

  @Prop({ type: String, default: "JOINED" })
  status?: string;

  @Prop({ type: Date })
  leftAt?: Date;
}

export const ChannelMemberSchema = SchemaFactory.createForClass(ChannelMember);
