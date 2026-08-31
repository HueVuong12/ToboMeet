// src/meetings/meetings.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  ChannelMeetingsController,
  MeetingsController,
} from "./meetings.controller";
import { MeetingsService } from "./meetings.service";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import {
  RoomActivity,
  RoomActivitySchema,
} from "../rooms/schemas/room-activity.schema";
import { MeetingsGateway } from "./meetings.gateway";
import { SupabaseModule } from "../supabase/supabase.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CoreModule } from "../core/core.module";
import {
  MeetingSession,
  MeetingSessionSchema,
} from "./schemas/meeting-session.schema";
import { MeetingInviteService } from "./meeting-invite.service";
import { BreakoutRoomsController } from "./breakout-rooms.controller";
import { BreakoutRoomsService } from "./breakout-rooms.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomActivity.name, schema: RoomActivitySchema },
      { name: MeetingSession.name, schema: MeetingSessionSchema },
    ]),
    SupabaseModule,
    NotificationsModule,
    CoreModule,
  ],
  controllers: [
    BreakoutRoomsController,
    MeetingsController,
    ChannelMeetingsController,
  ],
  providers: [
    BreakoutRoomsService,
    MeetingsService,
    MeetingInviteService,
    MeetingsGateway,
  ],
  exports: [
    BreakoutRoomsService,
    MeetingsService,
    MeetingInviteService,
    MeetingsGateway,
  ],
})
export class MeetingsModule {}
