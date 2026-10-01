import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class JobRecord extends Document {
    @Prop({ required: true })
    targetQueue: string; // Tên queue đích (ví dụ: 'calendar-events')

    @Prop({ type: Object, required: true })
    payload: Record<string, any>; // Gói hàng gửi về (chứa eventId)

    @Prop({ required: true })
    triggerAt: Date; // Thời điểm cần kích hoạt

    @Prop({ required: true, enum: ['PENDING', 'QUEUED', 'COMPLETED', 'FAILED'], default: 'PENDING' })
    status: string;

    @Prop({ type: Date })
    executedAt?: Date;
}

export const JobRecordSchema = SchemaFactory.createForClass(JobRecord);