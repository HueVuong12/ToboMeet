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
}

export const UserSchema = SchemaFactory.createForClass(User);
