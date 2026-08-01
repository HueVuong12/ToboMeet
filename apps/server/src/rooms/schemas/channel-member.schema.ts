import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class ChannelMember {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, default: "member" })
  role: string;
}

export const ChannelMemberSchema = SchemaFactory.createForClass(ChannelMember);
