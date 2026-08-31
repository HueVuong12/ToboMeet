import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AssignmentSubmissionDocument = AssignmentSubmission & Document;

@Schema({ timestamps: true })
export class AssignmentSubmission {
  @Prop({ required: true, index: true })
  assignmentId: string;

  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true, index: true })
  channelId: string;

  @Prop({
    type: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
      size: { type: Number },
      type: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    }],
    default: [],
  })
  attachments: {
    name: string;
    url: string;
    size?: number;
    type?: string;
    uploadedAt?: Date;
  }[];

  @Prop({ required: true })
  submittedAt: Date;

  @Prop({
    required: true,
    enum: ["on_time", "late"],
    default: "on_time",
  })
  submissionStatus: string;

  @Prop({ type: Number, default: 0 })
  lateMinutes: number;

  @Prop({ type: Number })
  score?: number;

  @Prop()
  feedback?: string;

  @Prop()
  gradedBy?: string;

  @Prop()
  gradedAt?: Date;

  @Prop({
    type: [{
      userId: { type: String, required: true },
      userName: { type: String, required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  })
  comments: {
    userId: string;
    userName: string;
    content: string;
    createdAt: Date;
  }[];
}

export const AssignmentSubmissionSchema = SchemaFactory.createForClass(AssignmentSubmission);
