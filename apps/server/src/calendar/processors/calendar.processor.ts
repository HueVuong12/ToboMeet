import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CalendarService } from "../calendar.service";

export interface CalendarTaskJobData {
  eventId: string;
  occurrenceDate: string;
  title?: string;
  meetingCode?: string;
  jobRecordId?: string;
  dispatchedAt?: string;
}

@Processor("calendar", { concurrency: 5 })
export class CalendarProcessor extends WorkerHost {
  constructor(private readonly calendarService: CalendarService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const taskData = job.data as CalendarTaskJobData;

    // Calendar service xử lý task tới hạn và tính toán lần chạy tiếp theo
    await this.calendarService.handleCalendarTaskFromQueue(taskData);

    return { processed: true, eventId: taskData.eventId };
  }
}
