import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type RoomReportDocument = RoomReport & Document;

@Schema({ timestamps: true })
export class RoomReport {
  @Prop({ required: true, index: true })
  roomId: string;

  @Prop({ required: true })
  reporterId: string;

  @Prop({ required: true, enum: ["spam", "inappropriate", "harassment", "other"] })
  reason: string;

  @Prop()
  details?: string;

  @Prop({ required: true, enum: ["pending", "resolved"], default: "pending" })
  status: string;
}

export const RoomReportSchema = SchemaFactory.createForClass(RoomReport);
