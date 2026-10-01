import { Controller, Post, Body, Delete, Param } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { IsString, IsObject, IsDateString } from 'class-validator';

export class CreateJobDto {
    @IsString() targetQueue: string;
    @IsObject() payload: Record<string, any>;
    @IsDateString() triggerAt: string;
}

@Controller('api/v1/jobs')
export class JobsController {
    constructor(private readonly jobsService: JobsService) { }

    @Post()
    async scheduleJob(@Body() dto: CreateJobDto) {
        return this.jobsService.createJob(dto);
    }

    @Delete('by-event/:eventId')
    async cancelJobByEvent(@Param('eventId') eventId: string) {
        return this.jobsService.deleteJobByEvent(eventId);
    }

    @Delete(':id')
    async cancelJob(@Param('id') id: string) {
        return this.jobsService.deleteJob(id);
    }
}