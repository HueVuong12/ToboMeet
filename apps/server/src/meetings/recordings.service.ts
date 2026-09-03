import { Injectable } from "@nestjs/common";
import {
    RoomServiceClient,
    TrackSource,
    EgressClient,
    EncodedFileOutput,
    DirectFileOutput,
    EncodedFileType,
} from "livekit-server-sdk";
import { AppException } from "../core/exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";

@Injectable()
export class RecordingsService {
    private livekitRoomService: RoomServiceClient;
    private egressClient: EgressClient;

    constructor() {
        const livekitHost = process.env.LIVEKIT_API_URL;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (livekitHost && apiKey && apiSecret) {
            this.livekitRoomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);
            this.egressClient = new EgressClient(livekitHost, apiKey, apiSecret);
        }
    }

    /**
     * Bắt đầu ghi hình phân tách: Âm thanh tổng (MP4) + Màn hình chia sẻ (WebM Raw)
     */
    async startRecording(meetingCode: string): Promise<void> {
        if (!this.egressClient || !this.livekitRoomService) {
            throw new AppException(ErrorCode.SERVER_ERROR);
        }

        const timestamp = Date.now();
        const egressJobs: string[] = [];

        // 1. QUAY ÂM THANH TỔNG (Audio Mixer nội bộ của LiveKit)
        const audioOutput = new EncodedFileOutput({
            fileType: EncodedFileType.MP4,
            filepath: `/out/${meetingCode}/${meetingCode}-${timestamp}-audio.mp4`,
        });

        try {
            const audioJob = await this.egressClient.startRoomCompositeEgress(
                meetingCode,
                audioOutput,
                { audioOnly: true, videoOnly: false }
            );
            egressJobs.push(audioJob.egressId);

            // 2. TÌM LUỒNG MÀN HÌNH CHIA SẺ VÀ QUAY RAW (WebM)
            const participants = await this.livekitRoomService.listParticipants(meetingCode);
            let screenShareTrackId = null;

            for (const p of participants) {
                const track = p.tracks.find((t) => t.source === TrackSource.SCREEN_SHARE);
                if (track) {
                    screenShareTrackId = track.sid;
                    break; // Lấy luồng màn hình đầu tiên tìm thấy
                }
            }

            if (screenShareTrackId) {
                const screenOutput = new DirectFileOutput({
                    filepath: `/out/${meetingCode}/${meetingCode}-${timestamp}-screen.webm`,
                });

                const screenJob = await this.egressClient.startTrackEgress(
                    meetingCode,
                    screenOutput,
                    screenShareTrackId
                );
                egressJobs.push(screenJob.egressId);
            }

            return;
        } catch (error) {
            console.error("Lỗi khi khởi động Egress:", error);
            throw new AppException(ErrorCode.SERVER_ERROR);
        }
    }

    /**
     * Dừng toàn bộ các tiến trình ghi hình của phòng
     */
    async stopRecording(meetingCode: string): Promise<void> {
        if (!this.egressClient) {
            throw new AppException(ErrorCode.SERVER_ERROR);
        }

        try {
            // Bắt toàn bộ các Egress đang chạy của phòng
            const activeEgresses = await this.egressClient.listEgress({
                roomName: meetingCode,
                active: true,
            });

            if (activeEgresses.length === 0) {
                return;
            }

            // Tắt đồng loạt
            const stopPromises = activeEgresses.map((egress) =>
                this.egressClient.stopEgress(egress.egressId)
            );

            await Promise.all(stopPromises);
            return;
        } catch (error) {
            console.error("Lỗi khi dừng Egress:", error);
            throw new AppException(ErrorCode.SERVER_ERROR);
        }
    }

    /**
    * Tự động bắt luồng màn hình mới nếu phòng đang trong trạng thái ghi hình
    */
    async handleNewScreenShareTrack(meetingCode: string, trackId: string) {
        if (!this.egressClient) return;

        try {
            // Kiểm tra xem phòng này có đang được ghi hình (quay audio) không
            const activeEgresses = await this.egressClient.listEgress({
                roomName: meetingCode,
                active: true,
            });

            if (activeEgresses.length === 0) return;

            const screenOutput = new DirectFileOutput({
                filepath: `/out/${meetingCode}/${meetingCode}-${Date.now()}-screen.webm`,
            });

            await this.egressClient.startTrackEgress(
                meetingCode,
                screenOutput,
                trackId
            );
        } catch (error) {
            console.error("Lỗi khi tự động quay màn hình từ Webhook:", error);
        }
    }
}