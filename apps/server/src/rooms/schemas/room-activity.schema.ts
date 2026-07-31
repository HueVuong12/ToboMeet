import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type RoomActivityDocument = RoomActivity & Document;

@Schema({ timestamps: true })
export class RoomActivity {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({
    required: true,
    enum: [
      "CREATED",
      "MEETING_STARTED",
      "MEETING_ENDED",
      "USER_JOINED",
      "USER_LEFT",
      "MEMBER_REMOVED",
      "SCREEN_SHARE",
      "POLL_CREATED",
      "WHITEBOARD_CREATED",
      "DISBANDED",
      "ROLE_UPDATED",
      "OWNER_TRANSFERRED",
    ],
  })
  type: string;

  @Prop({ type: Object })
  metadata?: {
    userId?: string;
    displayName?: string;
    email?: string;
    details?: string;
    [key: string]: unknown;
  };
}

export const RoomActivitySchema = SchemaFactory.createForClass(RoomActivity);
