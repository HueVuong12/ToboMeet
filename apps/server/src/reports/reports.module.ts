import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { Report, ReportSchema } from "./schemas/report.schema";
import { RoomReport, RoomReportSchema } from "../rooms/schemas/room-report.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import { SupabaseModule } from "../supabase/supabase.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { MeetingsModule } from "../meetings/meetings.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: RoomReport.name, schema: RoomReportSchema },
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    SupabaseModule,
    NotificationsModule,
    forwardRef(() => MeetingsModule),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService, MongooseModule],
})
export class ReportsModule {}
