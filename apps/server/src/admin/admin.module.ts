import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import { Meeting, MeetingSchema } from "../meetings/schemas/meeting.schema";
import { MeetingsModule } from "../meetings/meetings.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Meeting.name, schema: MeetingSchema },
    ]),
    forwardRef(() => MeetingsModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
