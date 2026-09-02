import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AssignmentDocument = Assignment & Document;

@Schema({ timestamps: true })
export class Assignment {
  @Prop({ required: false })
  title?: string;

  @Prop()
  description?: string;

  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: false, index: true })
  channelId?: string;

  @Prop({ type: [String], default: [], index: true })
  channelIds: string[];

  @Prop({ required: false })
  startDate?: Date;

  @Prop({ required: false })
  deadline?: Date;

  @Prop({
    required: false,
    enum: ["allow_late", "lock_after_deadline"],
    default: "allow_late",
  })
  submissionPolicy?: string;

  @Prop({
    required: false,
    enum: ["all_current_and_future", "current_members", "current_and_future_members", "specific_members"],
    default: "current_and_future_members",
  })
  recipientType?: string;

  @Prop({ type: [String], default: [] })
  recipientMemberIds: string[];

  @Prop({
    required: false,
    enum: ["graded", "ungraded"],
    default: "graded",
  })
  gradingType?: string;

  @Prop({ type: Number })
  maxScore?: number;

  @Prop({
    type: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
      size: { type: Number },
      type: { type: String },
    }],
    default: [],
  })
  attachments: {
    name: string;
    url: string;
    size?: number;
    type?: string;
  }[];

  @Prop({
    required: true,
    enum: ["draft", "published"],
    default: "draft",
  })
  status: string;

  @Prop({ required: true })
  createdBy: string;
}

export const AssignmentSchema = SchemaFactory.createForClass(Assignment);
