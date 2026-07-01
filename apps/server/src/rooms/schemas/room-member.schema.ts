import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class RoomMember {
  @Prop({ required: true, index: true }) // Đánh index để search phòng theo userId nhanh hơn
  userId: string;

  @Prop({
    required: true,
    enum: ["owner", "admin", "member"],
    default: "member",
  })
  role: string;

  @Prop({ default: () => new Date() })
  joinedAt: Date;
}
export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);
