import { Injectable, Logger } from "@nestjs/common";
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
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

const execPromise = promisify(exec);

@Injectable()
export class RecordingsService {
    private livekitRoomService: RoomServiceClient;
    private egressClient: EgressClient;
    private readonly logger = new Logger(RecordingsService.name);

    constructor(
        @InjectQueue("meeting") private meetingQueue: Queue,
    ) {
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

            await this.meetingQueue.add(
                "process-recording",
                { meetingCode },
                {
                    delay: 10000,      // Đợi 10 giây để Egress chép xong file JSON/Video ra ổ cứng
                    removeOnComplete: true, // Chạy xong tự xóa khỏi Redis cho nhẹ máy
                    attempts: 3,       // Tự động thử lại tối đa 3 lần nếu FFmpeg lỗi
                    backoff: {
                        type: 'exponential',
                        delay: 5000      // Nếu lỗi, lần 1 đợi 5s, lần 2 đợi 10s...
                    }
                }
            );

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

    /**
   * Xử lý hậu kì
   */
    async handlePostProcessing(meetingCode: string) {
        try {
            const basePath = process.env.RECORDING_STORAGE_PATH || path.join(process.cwd(), "recordings");
            const recordingsDir = path.join(basePath, meetingCode);

            // 1. Kiểm tra thư mục có tồn tại
            const stats = await fs.stat(recordingsDir).catch(() => null);
            if (!stats || !stats.isDirectory()) {
                this.logger.warn(`Thư mục recordings không tồn tại cho ${meetingCode}`);
                return;
            }

            const files = await fs.readdir(recordingsDir);
            const jsonFiles = files.filter(f => f.endsWith(".json"));

            let audioManifest: any = null;
            let audioFileLocalPath = "";
            const screenSegments: { file: string; startOffset: number; endOffset: number }[] = [];

            // 2. Phân tích các file JSON để tìm Audio gốc và các đoạn Video
            for (const jsonFile of jsonFiles) {
                const jsonContent = await fs.readFile(path.join(recordingsDir, jsonFile), "utf8");
                const manifest = JSON.parse(jsonContent);

                if (!manifest.files || manifest.files.length === 0) continue;

                const internalFilename = manifest.files[0].filename; // vd: /out/meet-123/meet-123-audio.mp4
                const actualFileName = path.basename(internalFilename);
                const actualFilePath = path.join(recordingsDir, actualFileName);

                if (internalFilename.includes("audio")) {
                    audioManifest = manifest;
                    audioFileLocalPath = actualFilePath;
                } else if (internalFilename.includes("screen")) {
                    screenSegments.push({
                        manifest,
                        actualFilePath
                    } as any);
                }
            }

            if (!audioManifest) {
                this.logger.warn(`Không tìm thấy file audio cho ${meetingCode}. Hủy ghép video.`);
                return;
            }

            // Thời gian bắt đầu tuyệt đối (Nanoseconds -> Seconds)
            const audioStartTime = audioManifest.started_at;

            // 3. Tính toán Timeline cho từng đoạn Screen Share
            const segmentsToRender = screenSegments.map((seg: any) => {
                const startOffset = Math.max(0, (seg.manifest.started_at - audioStartTime) / 1e9);
                const endOffset = Math.max(startOffset, (seg.manifest.ended_at - audioStartTime) / 1e9);
                return {
                    file: seg.actualFilePath,
                    startOffset,
                    endOffset
                };
            }).sort((a, b) => a.startOffset - b.startOffset);

            const finalOutputPath = path.join(recordingsDir, `${meetingCode}-final-1080p.mp4`);

            // 4. Xây dựng câu lệnh FFmpeg
            // Input 0: Nền đen tỷ lệ 1920x1080
            let ffmpegCmd = `"D:\\KLTN\\ffmpeg\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe" -y -f lavfi -i color=c=black:s=1920x1080:r=24 `;

            // Input 1: Audio file
            ffmpegCmd += `-i "${audioFileLocalPath}" `;

            // Input 2 -> N: Các đoạn Screen Share
            segmentsToRender.forEach(seg => {
                ffmpegCmd += `-itsoffset ${seg.startOffset} -i "${seg.file}" `;
            });

            let filterComplex = ``;
            let lastOutput = `0:v`; // Bắt đầu bằng nền đen

            // 5. Build Filter: Scale từng video lên 1920x1080 (giữ tỷ lệ, viền đen nếu cần) rồi Overlay
            segmentsToRender.forEach((seg, index) => {
                const inputIndex = index + 2;
                const scaledOutput = `scaled${index}`;
                const overlayOutput = `out${index}`;

                // Scale & Pad giữ nguyên khung hình 1920x1080
                filterComplex += `[${inputIndex}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[${scaledOutput}];`;

                // Dán đè lên nền theo timeline
                filterComplex += `[${lastOutput}][${scaledOutput}]overlay=x=0:y=0:enable='between(t,${seg.startOffset},${seg.endOffset})'[${overlayOutput}];`;

                lastOutput = overlayOutput;
            });

            // Ráp lệnh cuối
            if (filterComplex.length > 0) {
                // ĐÃ THÊM -shortest TRƯỚC TÊN FILE OUTPUT
                ffmpegCmd += `-filter_complex "${filterComplex}" -map "[${lastOutput}]" -map 1:a -c:v libx264 -preset veryfast -c:a copy -shortest "${finalOutputPath}"`;
            } else {
                // Nếu cuộc họp không có ai share màn hình, kết xuất 1 file video nền đen + audio
                ffmpegCmd += `-map 0:v -map 1:a -c:v libx264 -preset veryfast -c:a copy -shortest "${finalOutputPath}"`;
            }

            this.logger.log(`Bắt đầu chạy FFmpeg cho ${meetingCode}`);

            // 6. Thực thi FFmpeg
            const { stdout, stderr } = await execPromise(ffmpegCmd);
            this.logger.log(`Hậu kỳ thành công cho ${meetingCode}. File xuất tại: ${finalOutputPath}`);

            // (Tùy chọn) Gắn logic upload AWS S3 ở đây
        } catch (error) {
            this.logger.error(`Lỗi xử lý hậu kỳ cho ${meetingCode}:`, error);
        }
    }
}