// src/webhooks/webhooks.controller.ts
import {
  Controller,
  Post,
  Req,
  RawBodyRequest,
  Headers,
} from "@nestjs/common";
import { WebhookReceiver } from "livekit-server-sdk";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("webhooks")
export class WebhooksController {
  private receiver: WebhookReceiver;

  constructor(
    @InjectQueue("meeting") private readonly meetingQueue: Queue,
  ) {
    this.receiver = new WebhookReceiver(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    );
  }

  @Post("livekit")
  async handleLiveKitWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("authorization") authHeader: string,
  ) {
    const rawBody = req.rawBody ? req.rawBody.toString() : "";
    const event = await this.receiver.receive(rawBody, authHeader);

    const meetingCode = event.room?.name;
    const userId = event.participant?.identity;
    const displayName = event.participant?.name;

    switch (event.event) {
      case "participant_joined":
        if (meetingCode && userId) {
          await this.meetingQueue.add(
            "attendance-joined",
            { meetingCode, userId, displayName },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
              removeOnComplete: 100,
              removeOnFail: 50,
            },
          );
        }
        break;

      case "participant_left":
        if (meetingCode && userId) {
          await this.meetingQueue.add(
            "attendance-left",
            { meetingCode, userId },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
              removeOnComplete: 100,
              removeOnFail: 50,
            },
          );
        }
        break;

      case "room_finished":
        if (meetingCode) {
          // Đóng hết visit còn mở + end session nếu cần
          await this.meetingQueue.add(
            "attendance-close-all",
            { meetingCode },
            {
              attempts: 3,
              removeOnComplete: true,
            },
          );
        }
        break;
    }

    return { received: true };
  }
}