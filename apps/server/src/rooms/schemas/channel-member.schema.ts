import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class ChannelMember {
  @Prop({ required: true })
  userId: string;

  @Prop({
    required: true,
    enum: ["admin", "member"], // Không lưu owner trong channel.members vì owner có quyền cao nhất, không cần lưu
    default: "member",
  })
  role: string;
}

export const ChannelMemberSchema = SchemaFactory.createForClass(ChannelMember);
