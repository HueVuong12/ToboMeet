// src/meetings/attendance.service.ts
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RoomServiceClient } from "livekit-server-sdk";
import { AppException } from "../core/exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";
import {
    Attendance,
    AttendanceDocument,
} from "./schemas/attendance.schema";
import {
    MeetingSession,
    MeetingSessionDocument,
} from "./schemas/meeting-session.schema";
import * as ExcelJS from 'exceljs';

const formatDate = (dateInput?: Date): string => {
    if (!dateInput) return '-';

    const d = new Date(dateInput);
    const pad = (n: number) => n.toString().padStart(2, '0');

    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1); // Tháng trong JS bắt đầu từ 0
    const year = d.getFullYear();

    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
};

@Injectable()
export class AttendanceService {
    private readonly logger = new Logger(AttendanceService.name);
    private livekitRoomService: RoomServiceClient;

    constructor(
        @InjectModel(Attendance.name)
        private attendanceModel: Model<AttendanceDocument>,
        @InjectModel(MeetingSession.name)
        private sessionModel: Model<MeetingSessionDocument>,
    ) {
        const livekitHost = process.env.LIVEKIT_API_URL;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (livekitHost && apiKey && apiSecret) {
            this.livekitRoomService = new RoomServiceClient(
                livekitHost,
                apiKey,
                apiSecret,
            );
        }
    }

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

    async generateAttendanceExcel(attendances: AttendanceDocument[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Lịch sử vào ra');

        // Khai báo cột cố định
        sheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Tên', key: 'name', width: 25 },
            { header: 'Tổng thời gian', key: 'total', width: 15 },
            { header: 'Lượt', key: 'visitIndex', width: 10 },
            { header: 'Vào', key: 'join', width: 20 },
            { header: 'Ra', key: 'leave', width: 20 },
            { header: 'Thời lượng lượt', key: 'duration', width: 15 },
        ];

        let stt = 1;

        attendances.forEach((record) => {
            const totalMinutes = Math.round(record.totalDurationSeconds / 60);

            if (record.visits && record.visits.length > 0) {
                record.visits.forEach((visit, index) => {
                    sheet.addRow({
                        stt: index === 0 ? stt : '',
                        name: record.displayName || 'Khách',
                        total: index === 0 ? `${totalMinutes} phút` : '',
                        visitIndex: index + 1,
                        join: formatDate(visit.joinedAt),
                        leave: visit.leftAt ? formatDate(visit.leftAt) : '_',
                        duration: `${Math.round(visit.durationSeconds / 60)} phút`,
                    });
                });
            } else {
                sheet.addRow({
                    stt: stt,
                    name: record.displayName || 'Khách',
                    total: '0 phút',
                    visitIndex: 'Không có',
                    join: '-', leave: '-', duration: '-'
                });
            }

            stt++; // Sang user tiếp theo
        });

        // Bôi màu Header cho đẹp
        sheet.getRow(1).font = { bold: true };

        const excelData = await workbook.xlsx.writeBuffer();
        return Buffer.from(excelData);
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

    /**
     * Xuất danh sách điểm danh ra file Excel:
     * Dùng batch get để lấy từng trang attendance rồi gọi generateAttendanceExcel.
     */
    async exportAttendanceExcel(
        meetingCode: string,
        sessionId?: string,
    ): Promise<{ buffer: Buffer; fileName: string }> {
        let targetSessionId = sessionId;

        if (!targetSessionId) {
            const session = await this.sessionModel
                .findOne({ meetingCode })
                .sort({ createdAt: -1 })
                .lean();
            if (!session) {
                throw new AppException(ErrorCode.MEETING_NOT_FOUND);
            }
            targetSessionId = session._id.toString();
        }

        // Lấy tất cả attendance bằng batch processing
        const batchSize = 100;
        let skip = 0;
        const allAttendances: AttendanceDocument[] = [];
        let hasMore = true;

        while (hasMore) {
            const batch = await this.attendanceModel
                .find({ sessionId: targetSessionId })
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(batchSize)
                .exec();

            if (batch.length > 0) {
                allAttendances.push(...batch);
                skip += batch.length;
                if (batch.length < batchSize) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        const buffer = await this.generateAttendanceExcel(allAttendances);
        const fileName = `diem-danh-${meetingCode}-${targetSessionId.slice(-6)}.xlsx`;

        return { buffer, fileName };
    }

    /**
     * Đổi tên người dùng trong cuộc họp:
     * 1. Cập nhật tên trong Attendance DB trước.
     * 2. Nếu ghi DB lỗi thì ném AppException.
     * 3. Sau đó gọi LiveKit RoomService để đồng bộ realtime cho mọi người trong phòng.
     */
    async renameParticipant(
        meetingCode: string,
        userId: string,
        newName: string,
    ): Promise<void> {
        if (!newName || !newName.trim()) {
            throw new BadRequestException("Tên người dùng không được để trống");
        }
        const trimmedName = newName.trim();

        // Cập nhật DB trước
        try {
            const session = await this.findOngoingSession(meetingCode);
            if (session) {
                const sessionId = session._id.toString();
                await this.attendanceModel.updateOne(
                    { sessionId, userId },
                    {
                        $set: {
                            displayName: trimmedName,
                            meetingCode,
                        },
                        $setOnInsert: {
                            sessionId,
                            userId,
                            totalDurationSeconds: 0,
                            visits: [],
                        },
                    },
                    { upsert: true },
                );
            } else {
                await this.attendanceModel.updateOne(
                    { meetingCode, userId },
                    { $set: { displayName: trimmedName } },
                );
            }
        } catch (error) {
            throw new AppException(ErrorCode.RENAME_PARTICIPANT_FAILED);
        }

        // Gọi LiveKit cập nhật realtime
        if (this.livekitRoomService) {
            try {
                await this.livekitRoomService.updateParticipant(
                    meetingCode,
                    userId,
                    { name: trimmedName },
                );
            } catch (error) {
                throw new AppException(ErrorCode.RENAME_PARTICIPANT_FAILED);
            }
        }
    }
}