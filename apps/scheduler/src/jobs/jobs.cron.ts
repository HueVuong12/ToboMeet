import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobRecord } from './schemas/job.schema';
import { JobsService } from './jobs.service';

@Injectable()
export class JobsCron {
    private readonly logger = new Logger(JobsCron.name);

    constructor(
        @InjectModel(JobRecord.name) private jobModel: Model<JobRecord>,
        private readonly jobsService: JobsService,
    ) { }

    @Cron('*/15 * * * *')
    async scanPendingJobs() {
        this.logger.log('Scanning for upcoming jobs...');
        // lookaheadTime đảm bảo ko quét sót
        // VD: task ở 8h17, crons job quét vào đúng 8h15, lần kế tiếp quét vào 8h30 -> task 8h17 bị trễ 15p mới được thông báo (8h32)
        const lookaheadTime = new Date(Date.now() + 20 * 60 * 1000);

        // Thời điểm quét: 8h15, scan những job có lịch trình trước 8h35 xem có job nào lọt trong khoảng này
        const upcomingJobs = await this.jobModel.find({
            status: 'PENDING',
            triggerAt: { $lte: lookaheadTime },
        }).limit(1000).exec();

        for (const job of upcomingJobs) {
            const delay = job.triggerAt.getTime() - Date.now();

            try {
                await this.jobsService.pushToQueue(job, delay);
                job.status = 'QUEUED';
                await job.save();
            } catch (err) {
                this.logger.error(`Failed to queue job ${job._id}`, err);
            }
        }
    }
}