import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

// meeting.schema.ts
@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true })
  roomId: string; // Thuộc phòng nào

  @Prop({ required: true })
  channelName: string; // Thuộc kênh nào (ví dụ: "General")

  @Prop({ required: true, unique: true })
  meetingCode: string; // Mã để join (LiveKit Room Name)

  @Prop({ required: true, enum: ['scheduled', 'ongoing', 'ended'], default: 'ongoing' })
  status: string;
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);