// src/meetings/meetings.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MeetingsController } from "./meetings.controller";
import { MeetingsService } from "./meetings.service";
import { Meeting, MeetingSchema } from "./schemas/meeting.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import { MeetingsGateway } from "./meetings.gateway";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Meeting.name, schema: MeetingSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsGateway],
  exports: [MeetingsService, MeetingsGateway],
})
export class MeetingsModule {}
