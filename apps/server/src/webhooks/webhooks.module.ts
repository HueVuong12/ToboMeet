import { Module } from "@nestjs/common";

import { WebhooksController } from "./webhooks.controller";
import { MeetingsModule } from "../meetings/meetings.module";

@Module({
  imports: [MeetingsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
