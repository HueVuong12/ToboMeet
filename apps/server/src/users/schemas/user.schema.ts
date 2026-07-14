import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

@Schema({ _id: false })
export class LockHistory {
  @Prop({ required: true })
  lockedBy: string; // Email của Admin hoặc "AI"

  @Prop({ required: true, default: Date.now })
  lockedAt: Date;

  @Prop()
  lockedUntil?: Date;

  @Prop({ required: true })
  lockType: "TEMPORARY" | "INDEFINITE" | "WARNING";

  @Prop({ required: true })
  lockSource: "MANUAL" | "AI";

  @Prop({ required: true })
  violationType: string;

  @Prop({ required: true })
  violationCount: number;

  @Prop({ required: true })
  recommendedDuration: string;

  @Prop({ required: true })
  actualDuration: string;

  @Prop({ required: true })
  lockReason: string;

  @Prop({ required: true })
  emailSent: boolean;

  @Prop()
  unlockedAt?: Date;

  @Prop()
  unlockedBy?: string;
}

const LockHistorySchema = SchemaFactory.createForClass(LockHistory);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  supabaseId: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  displayName: string;

  @Prop()
  avatarUrl: string;

  @Prop({ required: true, enum: ["admin", "user", "moderator"], default: "user" })
  role: string;

  // --- HỆ THỐNG XỬ LÝ VI PHẠM (BAN SYSTEM) ---
  @Prop({ required: true, enum: ["ACTIVE", "BLOCKED"], default: "ACTIVE" })
  status: string;

  @Prop({ enum: ["TEMPORARY", "INDEFINITE", null], default: null })
  lockType: string;

  @Prop({ enum: ["MANUAL", "AI", null], default: null })
  lockSource: string;

  @Prop({ default: null })
  lockedAt: Date;

  @Prop({ default: null })
  lockedUntil: Date;

  @Prop({ default: null })
  lockReason: string;

  @Prop({ default: null })
  lockedBy: string;

  @Prop({ default: null })
  recommendedDuration: string;

  @Prop({ default: null })
  actualDuration: string;

  @Prop({ default: null })
  violationType: string;

  // Lưu số lần vi phạm của từng hành vi để Penalty Policy tự tính toán
  @Prop({ type: Map, of: Number, default: {} })
  violationCounts: Map<string, number>;

  // Lịch sử khóa tài khoản phục vụ Audit Log
  @Prop({ type: [LockHistorySchema], default: [] })
  lockHistory: LockHistory[];
}

export const UserSchema = SchemaFactory.createForClass(User);
