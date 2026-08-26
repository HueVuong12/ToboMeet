import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { BreakoutRoomsService } from "../breakout-rooms.service";

export interface AutoEndBreakoutJobData {
  mainMeetingCode: string;
  sessionStartedAt: number;
}

@Processor("meeting", { concurrency: 10 })
export class MeetingProcessor extends WorkerHost {
  private readonly logger = new Logger(MeetingProcessor.name);

  constructor(private readonly breakoutRoomsService: BreakoutRoomsService) {
    super();
  }

  async process(job: Job<AutoEndBreakoutJobData, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.name} (ID: ${job.id})`);

    switch (job.name) {
      case "auto-end-breakout": {
        const { mainMeetingCode, sessionStartedAt } = job.data;
        await this.breakoutRoomsService.handleAutoEndBreakout(
          mainMeetingCode,
          sessionStartedAt,
        );
        break;
      }
      default:
        this.logger.warn(`Unhandled job type: ${job.name}`);
        break;
    }
  }
}
