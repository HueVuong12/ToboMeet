import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationsService } from "./notifications.service";
import {
  Notification,
  NotificationSchema,
} from "./schemas/notification.schema";
import { CoreModule } from "../core/core.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    forwardRef(() => CoreModule),
    SupabaseModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [MongooseModule, NotificationsService],
})
export class NotificationsModule {}
