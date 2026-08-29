import { Module } from "@nestjs/common";

import { WebhooksController } from "./webhooks.controller";
import { MeetingsModule } from "../meetings/meetings.module";
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    MeetingsModule,
    BullModule.registerQueue({
      name: "meeting",
    }),
  ],
  controllers: [WebhooksController],
})
export class WebhooksModule { }
