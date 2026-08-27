import { forwardRef, Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "./schemas/user.schema";
import { DeviceSession, DeviceSessionSchema } from "./schemas/device-session.schema";
import { SupabaseModule } from "../supabase/supabase.module";
import { CoreModule } from "../core/core.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DeviceSession.name, schema: DeviceSessionSchema },
    ]),
    SupabaseModule,
    forwardRef(() => CoreModule),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
