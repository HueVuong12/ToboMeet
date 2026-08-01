import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { Room, RoomSchema } from "./schemas/room.schema";
import { RoomReport, RoomReportSchema } from "./schemas/room-report.schema";
import {
  RoomActivity,
  RoomActivitySchema,
} from "./schemas/room-activity.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { SupabaseModule } from "../supabase/supabase.module";
import { MeetingsModule } from "../meetings/meetings.module";
import { RoomsGateway } from "./rooms.gateway";
import { RoomMemberService } from "./room-member.service";
import { RoomChannelService } from "./room-channel.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Room.name, schema: RoomSchema },
      { name: RoomReport.name, schema: RoomReportSchema },
      { name: RoomActivity.name, schema: RoomActivitySchema },
      { name: User.name, schema: UserSchema },
    ]),
    SupabaseModule,
    MeetingsModule,
  ],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomMemberService,
    RoomChannelService,
    RoomsGateway,
  ],
  exports: [RoomsService, RoomMemberService, RoomChannelService, RoomsGateway],
})
export class RoomsModule {}
