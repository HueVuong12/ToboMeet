import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class RoomMember {
  @Prop({ required: true, index: true }) // Đánh index để search phòng theo userId nhanh hơn
  userId: string;

  @Prop({
    required: true,
    enum: ["owner", "vice", "member"],
    default: "member",
  })
  role: string;

  @Prop({ default: () => new Date() })
  joinedAt: Date;

  @Prop({ type: Boolean, default: false })
  isLeft?: boolean;

  @Prop({
    required: true,
    enum: ["ACTIVE", "REMOVED", "LEFT"],
    default: "ACTIVE",
  })
  status?: string;

  @Prop()
  removedBy?: string;

  @Prop()
  removedAt?: Date;

  @Prop()
  rejoinedAt?: Date;
}
export const RoomMemberSchema = SchemaFactory.createForClass(RoomMember);
