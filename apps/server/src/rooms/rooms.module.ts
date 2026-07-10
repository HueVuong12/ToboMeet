import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { Room, RoomSchema } from "./schemas/room.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { SupabaseModule } from "../supabase/supabase.module";
import { MeetingsModule } from "../meetings/meetings.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SupabaseModule,
    MeetingsModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
