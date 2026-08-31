// src/meetings/attendance.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
    Attendance,
    AttendanceDocument,
} from "./schemas/attendance.schema";
import {
    MeetingSession,
    MeetingSessionDocument,
} from "./schemas/meeting-session.schema";

@Injectable()
export class AttendanceService {
    private readonly logger = new Logger(AttendanceService.name);

    constructor(
        @InjectModel(Attendance.name)
        private attendanceModel: Model<AttendanceDocument>,
        @InjectModel(MeetingSession.name)
        private sessionModel: Model<MeetingSessionDocument>,
    ) { }

    /**
     * Tìm session đang ongoing theo meetingCode
     */
    private async findOngoingSession(meetingCode: string) {
        return this.sessionModel
            .findOne({ meetingCode, status: "ongoing" })
            .lean()
            .exec();
    }

    /**
     * User join phòng
     */
    async markJoined(
        meetingCode: string,
        userId: string,
        displayName?: string,
    ) {
        const session = await this.findOngoingSession(meetingCode);
        if (!session) return;

        const sessionId = session._id.toString();
        const now = new Date();

        const existing = await this.attendanceModel
            .findOne({ sessionId, userId }, { visits: 1 })
            .lean();

        const hasOpenVisit = existing?.visits?.some((v) => !v.leftAt);
        if (hasOpenVisit) {
            // Reconnect → chỉ cập nhật tên
            if (displayName) {
                await this.attendanceModel.updateOne(
                    { sessionId, userId },
                    { $set: { displayName } },
                );
            }
            return;
        }

        await this.attendanceModel.findOneAndUpdate(
            { sessionId, userId },
            {
                $set: {
                    displayName,
                    meetingCode,
                },
                $push: {
                    visits: {
                        joinedAt: now,
                        durationSeconds: 0,
                    },
                },
                $setOnInsert: {
                    sessionId,
                    userId,
                    totalDurationSeconds: 0,
                },
            },
            { upsert: true },
        );
    }

    /**
     * User leave phòng
     */
    async markLeft(meetingCode: string, userId: string) {
        const session = await this.findOngoingSession(meetingCode);
        if (!session) return;

        const sessionId = session._id.toString();
        const doc = await this.attendanceModel
            .findOne({ sessionId, userId })
            .lean();

        if (!doc?.visits?.length) return;

        const openIndex = doc.visits.findIndex((v) => !v.leftAt);
        if (openIndex === -1) return;

        const openVisit = doc.visits[openIndex];
        const leftAt = new Date();
        const thisDuration = Math.floor(
            (leftAt.getTime() - new Date(openVisit.joinedAt).getTime()) / 1000,
        );
        const newTotal = (doc.totalDurationSeconds || 0) + thisDuration;

        await this.attendanceModel.updateOne(
            { sessionId, userId },
            {
                $set: {
                    [`visits.${openIndex}.leftAt`]: leftAt,
                    [`visits.${openIndex}.durationSeconds`]: thisDuration,
                    totalDurationSeconds: newTotal,
                },
            },
        );
    }

    /**
     * Đóng tất cả visit đang mở khi phòng kết thúc
     */
    async closeAllOpenVisits(meetingCode: string) {
        const session = await this.findOngoingSession(meetingCode);
        if (!session) return;

        const sessionId = session._id.toString();
        const docs = await this.attendanceModel.find({
            sessionId,
            visits: { $elemMatch: { leftAt: { $exists: false } } },
        });

        if (docs.length === 0) return;

        const now = new Date();
        const bulkOps = docs
            .map((doc) => {
                const openIndex = doc.visits.findIndex((v) => !v.leftAt);
                if (openIndex === -1) return null;

                const openVisit = doc.visits[openIndex];
                const thisDuration = Math.floor(
                    (now.getTime() - openVisit.joinedAt.getTime()) / 1000,
                );
                const newTotal = (doc.totalDurationSeconds || 0) + thisDuration;

                return {
                    updateOne: {
                        filter: { _id: doc._id },
                        update: {
                            $set: {
                                [`visits.${openIndex}.leftAt`]: now,
                                [`visits.${openIndex}.durationSeconds`]: thisDuration,
                                totalDurationSeconds: newTotal,
                            },
                        },
                    },
                };
            })
            .filter(Boolean);

        if (bulkOps.length > 0) {
            await this.attendanceModel.bulkWrite(bulkOps as any);
        }
    }

    /**
     * Lấy danh sách điểm danh theo session
     */
    async getBySession(sessionId: string) {
        const list = await this.attendanceModel
            .find({ sessionId })
            .select("-__v")
            .lean();

        return list.map((item) => ({
            userId: item.userId,
            displayName: item.displayName,
            totalDurationSeconds: item.totalDurationSeconds,
            visitCount: item.visits?.length || 0,
            visits: item.visits,
            firstJoinedAt: item.visits?.[0]?.joinedAt,
            lastLeftAt: item.visits?.slice(-1)?.[0]?.leftAt,
        }));
    }

    /**
     * Lấy điểm danh theo meetingCode (session ongoing hoặc gần nhất)
     */
    async getByMeetingCode(meetingCode: string, sessionId?: string) {
        let targetSessionId = sessionId;

        if (!targetSessionId) {
            const session = await this.sessionModel
                .findOne({ meetingCode })
                .sort({ createdAt: -1 })
                .lean();
            if (!session) return [];
            targetSessionId = session._id.toString();
        }

        return this.getBySession(targetSessionId);
    }
}