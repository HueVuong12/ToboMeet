import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ScheduleJobRequest {
  targetQueue: string;
  triggerAt: Date | string;
  payload: Record<string, any>;
}

export interface ScheduleJobResponse {
  jobId: string;
  status: string;
}

@Injectable()
export class SchedulerClientService {
  private readonly logger = new Logger(SchedulerClientService.name);
  private readonly schedulerUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.schedulerUrl =
      this.configService.get<string>("SCHEDULER_SERVICE_URL") ||
      "http://localhost:2909";
  }

  /**
   * Gửi yêu cầu lên lịch tới Scheduler Service qua REST API
   */
  async scheduleJob(
    req: ScheduleJobRequest,
  ): Promise<ScheduleJobResponse | null> {
    const url = `${this.schedulerUrl}/api/v1/jobs`;
    const triggerAtIso =
      req.triggerAt instanceof Date
        ? req.triggerAt.toISOString()
        : new Date(req.triggerAt).toISOString();

    const body = {
      targetQueue: req.targetQueue,
      triggerAt: triggerAtIso,
      payload: req.payload,
    };

    try {
      this.logger.log(
        `[SchedulerClient] Calling POST ${url} for queue "${req.targetQueue}" to trigger at ${triggerAtIso}`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `[SchedulerClient] Scheduler service returned error HTTP ${response.status}: ${errText}`,
        );
        return null;
      }

      const data = (await response.json()) as ScheduleJobResponse;
      this.logger.log(
        `[SchedulerClient] Successfully scheduled job: ID=${data.jobId}, status=${data.status}`,
      );
      return data;
    } catch (err: any) {
      this.logger.error(
        `[SchedulerClient] Failed to send job to Scheduler Service (${url}): ${err?.message || err}`,
      );
      return null;
    }
  }

  /**
   * Hủy / xóa job trong Scheduler Service theo eventId
   */
  async cancelJobByEvent(eventId: string): Promise<boolean> {
    const url = `${this.schedulerUrl}/api/v1/jobs/by-event/${eventId}`;
    try {
      this.logger.log(`[SchedulerClient] Calling DELETE ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method: "DELETE",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `[SchedulerClient] Delete job failed HTTP ${response.status}: ${errText}`,
        );
        return false;
      }

      this.logger.log(
        `[SchedulerClient] Successfully cancelled job for event ${eventId}`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `[SchedulerClient] Failed to cancel job for event ${eventId}: ${err?.message || err}`,
      );
      return false;
    }
  }
}
