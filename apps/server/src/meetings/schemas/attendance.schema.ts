// attendance.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

@Schema({ _id: false })
export class Visit {
    @Prop({ required: true })
    joinedAt: Date;

    @Prop()
    leftAt?: Date;

    @Prop({ default: 0 })
    durationSeconds: number;
}

@Schema({ timestamps: true })
export class Attendance {
    @Prop({ required: true, index: true })
    sessionId: string;

    @Prop({ required: true, index: true })
    meetingCode: string;

    @Prop({ required: true, index: true })
    userId: string;

    @Prop()
    displayName?: string; // tên mới nhất

    @Prop({ type: [Visit], default: [] })
    visits: Visit[];

    @Prop({ default: 0 })
    totalDurationSeconds: number;

    @Prop({ default: false })
    isCounted: boolean;

    @Prop({ default: 'present' })
    status: 'present' | 'left_early' | 'late';
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// Mỗi user chỉ có 1 document trong 1 session
AttendanceSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
AttendanceSchema.index({ meetingCode: 1, userId: 1 });