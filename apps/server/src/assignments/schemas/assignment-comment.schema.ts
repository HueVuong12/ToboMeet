import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AssignmentCommentDocument = AssignmentComment & Document;

@Schema({ timestamps: true })
export class AssignmentComment {
  @Prop({ required: true, index: true })
  assignmentId: string;

  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true, default: "member" })
  role: string;

  @Prop({ required: true })
  content: string;
}

export const AssignmentCommentSchema = SchemaFactory.createForClass(AssignmentComment);
