import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UsersModule } from "./users/users.module";
import { RoomsModule } from "./rooms/rooms.module";
import { MeetingsModule } from "./meetings/meetings.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { AdminModule } from "./admin/admin.module";
import { SupabaseModule } from "./supabase/supabase.module";
import { ReportsModule } from "./reports/reports.module";
import { UploadsModule } from "./uploads/uploads.module";
import { NewsFeedModule } from "./news-feed/news-feed.module";
import { ChannelFilesModule } from "./channel-files/channel-files.module";
import { EventEmitterModule } from "@nestjs/event-emitter";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>("MONGODB_URI"),
      }),
      inject: [ConfigService],
    }),
    MeetingsModule,
    UsersModule,
    RoomsModule,
    WebhooksModule,
    AdminModule,
    SupabaseModule,
    ReportsModule,
    UploadsModule,
    NewsFeedModule,
    ChannelFilesModule,
  ],
})
export class AppModule {}
