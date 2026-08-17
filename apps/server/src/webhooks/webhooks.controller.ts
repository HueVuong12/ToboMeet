// src/webhooks/webhooks.controller.ts
import { Controller, Post, Req, RawBodyRequest, Headers } from "@nestjs/common";
import { WebhookReceiver } from "livekit-server-sdk";
import { MeetingsService } from "../meetings/meetings.service";

@Controller("webhooks")
export class WebhooksController {
  private receiver: WebhookReceiver;

  constructor(private meetingsService: MeetingsService) {
    this.receiver = new WebhookReceiver(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    );
  }

  @Post("livekit")
  async handleLiveKitWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("authorization") authHeader: string,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString() : "";
    const event = await this.receiver.receive(rawBody, authHeader);

    if (event.event === "participant_left") {
      const meetingCode = event.room.name;

      await this.meetingsService.checkAndCloseEmptyRoom(meetingCode);
    }

    return { received: true };
  }
}
