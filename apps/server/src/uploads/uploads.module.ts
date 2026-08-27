import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { User, UserSchema } from "../users/schemas/user.schema";

@Module({
  imports: [
    SupabaseModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
