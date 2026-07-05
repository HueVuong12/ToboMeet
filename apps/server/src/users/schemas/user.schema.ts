import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
