import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { JobRecord } from './schemas/job.schema';
import { CreateJobDto } from './jobs.controller';

@Injectable()
export class JobsService {
    private readonly LOOKAHEAD_WINDOW_MS = 20 * 60 * 1000; // 20 phút

    constructor(
        @InjectModel(JobRecord.name) private jobModel: Model<JobRecord>,
        @InjectQueue('dispatcher-queue') private dispatcherQueue: Queue,
    ) { }

    async createJob(dto: CreateJobDto) {
        const triggerTime = new Date(dto.triggerAt).getTime();
        const delay = triggerTime - Date.now();
        let status = 'PENDING';

        // Short-circuit: Nếu thời gian < 20 phút, đánh dấu QUEUED để cronjob bỏ qua
        if (delay <= this.LOOKAHEAD_WINDOW_MS) {
            status = 'QUEUED';
        }

        const newJob = await this.jobModel.create({
            targetQueue: dto.targetQueue,
            payload: dto.payload,
            triggerAt: new Date(dto.triggerAt),
            status,
        });

        if (status === 'QUEUED') {
            await this.pushToQueue(newJob, delay);
        }

        return { jobId: newJob._id, status };
    }

    async pushToQueue(job: any, delay: number) {
        await this.dispatcherQueue.add(
            'dispatch-task',
            { targetQueue: job.targetQueue, payload: job.payload, jobId: job._id },
            { delay: Math.max(0, delay), jobId: job._id.toString() }
        );
    }

    async deleteJobByEvent(eventId: string) {
        const jobs = await this.jobModel.find({ 'payload.eventId': eventId }).exec();

        for (const job of jobs) {
            try {
                const bullJob = await this.dispatcherQueue.getJob(job._id.toString());
                if (bullJob) {
                    await bullJob.remove();
                }
            } catch (err) {
                // Bỏ qua lỗi nếu job chưa nằm trong dispatcherQueue
            }
        }

        const result = await this.jobModel.deleteMany({ 'payload.eventId': eventId });
        return { success: true, deletedCount: result.deletedCount };
    }

    async deleteJob(jobId: string) {
        const job = await this.jobModel.findById(jobId).exec();
        if (job) {
            try {
                const bullJob = await this.dispatcherQueue.getJob(job._id.toString());
                if (bullJob) {
                    await bullJob.remove();
                }
            } catch (err) {
                // ignore
            }
            await this.jobModel.findByIdAndDelete(jobId);
        }
        return { success: true };
    }
}