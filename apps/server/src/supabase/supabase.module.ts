import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SupabaseService } from "./supabase.service";
import { DeviceSession, DeviceSessionSchema } from "../users/schemas/device-session.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeviceSession.name, schema: DeviceSessionSchema },
    ]),
  ],
  providers: [SupabaseService],
  exports: [SupabaseService, MongooseModule],
})
export class SupabaseModule {}
