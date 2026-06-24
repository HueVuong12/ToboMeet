import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  code: string;

  @Prop()
  supabaseId: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// Automatically delete OTP document when expiresAt is reached
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
