import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminRoomsController } from "./admin-rooms.controller";
import { AdminRoomsService } from "./admin-rooms.service";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema";
import { RoomReport, RoomReportSchema } from "../rooms/schemas/room-report.schema";
import { RoomActivity, RoomActivitySchema } from "../rooms/schemas/room-activity.schema";
import { MeetingsModule } from "../meetings/meetings.module";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Meeting.name, schema: MeetingSchema },
      { name: RoomReport.name, schema: RoomReportSchema },
      { name: RoomActivity.name, schema: RoomActivitySchema },
    ]),
    forwardRef(() => MeetingsModule),
    SupabaseModule,
  ],
  controllers: [AdminController, AdminRoomsController],
  providers: [AdminService, AdminRoomsService],
  exports: [AdminService, AdminRoomsService],
})
export class AdminModule {}
