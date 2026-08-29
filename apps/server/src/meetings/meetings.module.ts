// src/meetings/meetings.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import {
  ChannelMeetingsController,
  MeetingsController,
} from "./meetings.controller";
import { CalendarController } from "./calendar.controller";
import { MeetingsService } from "./meetings.service";
import { CalendarService } from "./calendar.service";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema";
import {
  CalendarEvent,
  CalendarEventSchema,
} from "./schemas/calendar-event.schema";
import {
  MeetingInvitation,
  MeetingInvitationSchema,
} from "./schemas/meeting-invitation.schema";
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
import { MeetingProcessor } from "./processors/meeting.processor";
import { Attendance, AttendanceSchema } from "./schemas/attendance.schema";
import { AttendanceService } from "./attendance.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: CalendarEvent.name, schema: CalendarEventSchema },
      { name: MeetingInvitation.name, schema: MeetingInvitationSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: RoomActivity.name, schema: RoomActivitySchema },
      { name: MeetingSession.name, schema: MeetingSessionSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: "Post", schema: require("../news-feed/schemas/post.schema").PostSchema },
    ]),
    BullModule.registerQueue({
      name: "meeting",
    }),
    SupabaseModule,
    NotificationsModule,
    CoreModule,
  ],
  controllers: [
    BreakoutRoomsController,
    MeetingsController,
    ChannelMeetingsController,
    CalendarController,
  ],
  providers: [
    BreakoutRoomsService,
    MeetingsService,
    MeetingInviteService,
    AttendanceService,
    CalendarService,
    MeetingsGateway,
    MeetingProcessor,
  ],
  exports: [
    AttendanceService,
    BreakoutRoomsService,
    MeetingsService,
    MeetingInviteService,
    CalendarService,
    MeetingsGateway,
  ],
})
export class MeetingsModule { }

