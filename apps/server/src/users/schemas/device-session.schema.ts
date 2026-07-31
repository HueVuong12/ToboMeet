import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type DeviceSessionDocument = DeviceSession & Document;

@Schema({ timestamps: true })
export class DeviceSession {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  ip: string;

  @Prop()
  ipAddress: string;

  @Prop({ required: true })
  userAgent: string;

  @Prop({ required: true })
  deviceName: string;

  @Prop({ required: true })
  os: string;

  @Prop({ required: true })
  browser: string;

  @Prop()
  city: string;

  @Prop()
  country: string;

  @Prop()
  isp: string;

  @Prop()
  loginMethod: string;

  @Prop({ default: false })
  isGps: boolean;

  @Prop({ default: false })
  isMobile: boolean;

  @Prop({ default: true })
  isDesktop: boolean;

  @Prop({ default: false })
  isRevoked: boolean;

  @Prop()
  revokedAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const DeviceSessionSchema = SchemaFactory.createForClass(DeviceSession);
