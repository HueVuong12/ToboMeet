// src/webhooks/webhooks.controller.ts
import { Controller, Post, Req, RawBodyRequest, Headers } from "@nestjs/common";
import { WebhookReceiver } from "livekit-server-sdk";
import { MeetingsService } from "../meetings/meetings.service";

@Controller("webhooks")
export class WebhooksController {
  private receiver: WebhookReceiver;

  constructor(private meetingsService: MeetingsService) {
    // Sử dụng secret được lưu trong .env
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

    if (event.event === "room_finished") {
      const meetingCode = event.room.name;
      await this.meetingsService.endMeetingByCode(meetingCode);
    }

    if (event.event === "participant_left") {
      // Kiểm tra xem số lượng người trong phòng có bằng 0
      if (event.room && event.room.numParticipants === 0) {
        const meetingCode = event.room.name;

        // Cập nhật trạng thái "ended" trong DB ngay tức thì (UI của bạn sẽ ăn theo)
        await this.meetingsService.endMeetingByCode(meetingCode);

        // Lập tức gọi API ép LiveKit giải tán phòng, hủy luôn cái Timeout chờ đợi của nó
        await this.meetingsService.forceDeleteLiveKitRoom(meetingCode);
      }
    }

    return { received: true };
  }
}
