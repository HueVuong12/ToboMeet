import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JobRecord } from './schemas/job.schema';

@Processor('dispatcher-queue')
export class JobsProcessor extends WorkerHost implements OnModuleDestroy {
    private readonly logger = new Logger(JobsProcessor.name);
    private readonly targetQueues = new Map<string, Queue>();

    constructor(
        @InjectModel(JobRecord.name) private readonly jobModel: Model<JobRecord>,
        private readonly configService: ConfigService,
    ) {
        super();
    }

    private getTargetQueue(queueName: string): Queue {
        let queue = this.targetQueues.get(queueName);
        if (!queue) {
            const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
            const port = Number(this.configService.get<number>('REDIS_PORT')) || 6379;
            const prefix = this.configService.get<string>('TARGET_QUEUE_PREFIX') || 'bull';

            queue = new Queue(queueName, {
                connection: { host, port },
                prefix,
                defaultJobOptions: {
                    removeOnComplete: true,
                },
            });
            this.targetQueues.set(queueName, queue);
        }
        return queue;
    }

    async process(job: Job): Promise<any> {
        const { targetQueue, payload, jobId } = job.data;
        this.logger.log(
            `[Scheduler Worker] Job ${job.id} (DB ID: ${jobId}) reached trigger time. Dispatching to target queue "${targetQueue}"...`,
        );

        try {
            const queue = this.getTargetQueue(targetQueue);

            // Forward to the target queue for main service (server)
            const addedJob = await queue.add('calendar-task', {
                ...payload,
                jobRecordId: jobId,
                dispatchedAt: new Date().toISOString(),
            });

            this.logger.log(
                `[Scheduler Worker] Successfully pushed job to "${targetQueue}" (Server Job ID: ${addedJob.id})`,
            );

            if (jobId) {
                await this.jobModel.findByIdAndDelete(jobId);
                this.logger.log(
                    `[Scheduler Worker] Deleted successfully processed job ${jobId} from MongoDB`,
                );
            }

            return { success: true, targetQueue, targetJobId: addedJob.id };
        } catch (error) {
            this.logger.error(
                `[Scheduler Worker] Failed to dispatch job ${job.id} to queue "${targetQueue}":`,
                error,
            );
            if (jobId) {
                await this.jobModel.findByIdAndUpdate(jobId, {
                    status: 'FAILED',
                });
            }
            throw error;
        }
    }

    async onModuleDestroy() {
        for (const [name, queue] of this.targetQueues.entries()) {
            try {
                await queue.close();
            } catch (err) {
                this.logger.error(`Error closing target queue ${name}:`, err);
            }
        }
        this.targetQueues.clear();
    }
}
