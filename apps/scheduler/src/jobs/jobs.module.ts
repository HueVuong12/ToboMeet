import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsCron } from './jobs.cron';
import { JobsProcessor } from './jobs.processor';
import { JobRecord, JobRecordSchema } from './schemas/job.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: JobRecord.name, schema: JobRecordSchema },
        ]),
        BullModule.registerQueue({
            name: 'dispatcher-queue',
        }),
    ],
    controllers: [JobsController],
    providers: [JobsService, JobsCron, JobsProcessor],
})
export class JobsModule { }