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
import * as crypto from "crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
    MeetingSession,
    MeetingSessionDocument,
} from "./schemas/meeting-session.schema";

const execPromise = promisify(exec);

@Injectable()
export class RecordingsService {
    private livekitRoomService: RoomServiceClient;
    private egressClient: EgressClient;
    private readonly logger = new Logger(RecordingsService.name);
    private readonly CALIBRATION_OFFSET = -0.3;

    constructor(
        @InjectQueue("meeting") private meetingQueue: Queue,
        @InjectModel(MeetingSession.name)
        private sessionModel: Model<MeetingSessionDocument>,
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

            // Tìm session hiện tại để truyền sessionId vào worker
            let session = await this.sessionModel.findOne({
                meetingCode,
                status: "ongoing",
            });
            if (!session) {
                session = await this.sessionModel
                    .findOne({ meetingCode })
                    .sort({ createdAt: -1 });
            }
            const sessionId = session?._id?.toString();

            // Tắt đồng loạt
            const stopPromises = activeEgresses.map((egress) =>
                this.egressClient.stopEgress(egress.egressId)
            );

            await Promise.all(stopPromises);

            await this.meetingQueue.add(
                "process-recording",
                { meetingCode, sessionId },
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
     * (Webhook) Tự động bắt luồng màn hình mới nếu phòng đang trong trạng thái ghi hình
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
    * (Worker) Xử lý hậu kì (ghép audio và screenshare) khi kết thúc quay cuộc họp
    */
    async handlePostProcessing(meetingCode: string, sessionId?: string) {
        try {
            const basePath = process.env.RECORDING_STORAGE_PATH || path.join(process.cwd(), "recordings");
            const recordingsDir = path.join(basePath, meetingCode);

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
            const processedJsonFiles: string[] = [];
            const processedMediaFiles: string[] = [];

            // Phân tích các file JSON để tìm Audio gốc và các đoạn Video
            for (const jsonFile of jsonFiles) {
                const jsonFilePath = path.join(recordingsDir, jsonFile);
                const jsonContent = await fs.readFile(jsonFilePath, "utf8");
                const manifest = JSON.parse(jsonContent);

                if (!manifest.files || manifest.files.length === 0) continue;

                const internalFilename = manifest.files[0].filename; // vd: /out/meet-123/meet-123-audio.mp4
                const actualFileName = path.basename(internalFilename);
                const actualFilePath = path.join(recordingsDir, actualFileName);

                if (internalFilename.includes("audio")) {
                    audioManifest = manifest;
                    audioFileLocalPath = actualFilePath;
                    processedJsonFiles.push(jsonFilePath);
                    processedMediaFiles.push(actualFilePath);
                } else if (internalFilename.includes("screen")) {
                    screenSegments.push({
                        manifest,
                        actualFilePath
                    } as any);
                    processedJsonFiles.push(jsonFilePath);
                    processedMediaFiles.push(actualFilePath);
                }
            }

            if (!audioManifest) {
                this.logger.warn(`Không tìm thấy file audio cho ${meetingCode}. Hủy ghép video.`);
                return;
            }

            // Lấy thông tin session tương ứng
            let session = null;
            if (sessionId) {
                session = await this.sessionModel.findById(sessionId);
            }
            if (!session) {
                session = await this.sessionModel.findOne({ meetingCode, status: "ongoing" });
            }
            if (!session) {
                session = await this.sessionModel.findOne({ meetingCode }).sort({ createdAt: -1 });
            }

            // Đảm bảo session có sessionFolder ngẫu nhiên
            let sessionFolder = session?.sessionFolder;
            if (!sessionFolder) {
                sessionFolder = `session_${crypto.randomUUID()}`;
                if (session) {
                    session.sessionFolder = sessionFolder;
                    await session.save();
                }
            }

            // Tạo tên thư mục ngẫu nhiên cho lần recording này (hậu kỳ cục bộ và R2)
            const recordingFolderName = `rec_${crypto.randomUUID()}`;

            // Thời gian bắt đầu tuyệt đối (Nanoseconds -> Seconds)
            const audioStartTime = audioManifest.started_at;

            // Tính toán Timeline cho từng đoạn Screen Share (có Calibration)
            const segmentsToRender = await Promise.all(
                screenSegments.map(async (seg: any) => {
                    // Tính offset gốc từ manifest
                    let startOffset = (seg.manifest.started_at - audioStartTime) / 1e9;
                    let endOffset = (seg.manifest.ended_at - audioStartTime) / 1e9;

                    startOffset += this.CALIBRATION_OFFSET;
                    endOffset += this.CALIBRATION_OFFSET;

                    // Không cho giá trị âm
                    startOffset = Math.max(0, startOffset);
                    endOffset = Math.max(startOffset, endOffset);

                    // Lấy duration thực từ file để chính xác hơn
                    try {
                        const { stdout } = await execPromise(
                            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${seg.actualFilePath}"`
                        );
                        const realDuration = parseFloat(stdout.trim());
                        if (!isNaN(realDuration) && realDuration > 0) {
                            endOffset = startOffset + realDuration;
                        }
                    } catch (err) {
                        this.logger.warn(`Không lấy được duration thực của ${seg.actualFilePath}, dùng ended_at`);
                    }

                    return {
                        file: seg.actualFilePath,
                        startOffset,
                        endOffset,
                    };
                })
            );

            segmentsToRender.sort((a, b) => a.startOffset - b.startOffset);

            // Tạo một thư mục con riêng biệt với tên random để chứa playlist (.m3u8) và các phân đoạn (.ts)
            const hlsOutputDir = path.join(recordingsDir, recordingFolderName);
            await fs.mkdir(hlsOutputDir, { recursive: true });

            const finalOutputPath = path.join(hlsOutputDir, `index.m3u8`);

            let ffmpegCmd = `ffmpeg -y -f lavfi -i color=c=black:s=1920x1080:r=30 `;
            ffmpegCmd += `-i "${audioFileLocalPath}" `;

            // Input các đoạn screen
            segmentsToRender.forEach((seg) => {
                ffmpegCmd += `-i "${seg.file}" `;
            });

            let filterComplex = ``;
            let lastOutput = `0:v`;

            segmentsToRender.forEach((seg, index) => {
                const inputIndex = index + 2;
                const shifted = `shifted${index}`;
                const overlayOut = `out${index}`;

                filterComplex += `[${inputIndex}:v]scale=1920:1080:force_original_aspect_ratio=decrease,` +
                    `pad=1920:1080:(ow-iw)/2:(oh-ih)/2,` +
                    `setpts=PTS-STARTPTS+${seg.startOffset}/TB[${shifted}];`;

                filterComplex += `[${lastOutput}][${shifted}]overlay=x=0:y=0:` +
                    `enable='between(t,${seg.startOffset},${seg.endOffset})'[${overlayOut}];`;

                lastOutput = overlayOut;
            });

            // Định nghĩa cấu hình HLS (Cắt nhỏ file)
            const baseEncoding = `-c:v libx264 -preset veryfast -r 30 -crf 23 -c:a copy`;
            // -hls_time 10: Độ dài mỗi chunk video là 10 giây.
            // -hls_list_size 0: Lưu lại toàn bộ các chunk vào playlist
            const hlsConfig = `-f hls -hls_time 10 -hls_list_size 0 -hls_segment_filename "${path.join(hlsOutputDir, 'segment_%03d.ts')}"`;

            if (filterComplex.length > 0) {
                ffmpegCmd += `-filter_complex "${filterComplex}" ` +
                    `-map "[${lastOutput}]" -map 1:a ` +
                    `${baseEncoding} -shortest ${hlsConfig} "${finalOutputPath}"`;
            } else {
                ffmpegCmd += `-map 0:v -map 1:a ${baseEncoding} -shortest ${hlsConfig} "${finalOutputPath}"`;
            }

            this.logger.log(`Bắt đầu chạy FFmpeg (HLS) cho ${meetingCode} vào thư mục ${recordingFolderName}`);

            await execPromise(ffmpegCmd);
            this.logger.log(`Hậu kỳ HLS thành công cho ${meetingCode}. Bắt đầu đẩy lên Cloudflare R2...`);

            // Tính thời lượng thực tế của video HLS
            let durationSeconds = 0;
            try {
                const { stdout } = await execPromise(
                    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalOutputPath}"`
                );
                const parsed = parseFloat(stdout.trim());
                if (!isNaN(parsed) && parsed > 0) {
                    durationSeconds = Math.round(parsed);
                }
            } catch (e) {
                if (audioManifest.ended_at && audioManifest.started_at) {
                    durationSeconds = Math.round((audioManifest.ended_at - audioManifest.started_at) / 1e9);
                }
            }

            // Bắn thư mục HLS vừa tạo lên R2 Object Storage
            const uploadResult = await this.uploadHlsToR2(sessionFolder, recordingFolderName, hlsOutputDir);

            // Xoá các file raw và JSON đã xử lý để tránh xung đột cho lần quay sau
            for (const p of [...processedJsonFiles, ...processedMediaFiles]) {
                await fs.unlink(p).catch(() => null);
            }

            // Chèn recording metadata vào MeetingSession
            const storagePath = `recordings/${sessionFolder}/${recordingFolderName}/index.m3u8`;
            const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
            const playlistUrl = r2PublicUrl
                ? `${r2PublicUrl.replace(/\/$/, "")}/${storagePath}`
                : storagePath;

            const recordingItem = {
                recordingId: crypto.randomUUID(),
                folderName: recordingFolderName,
                storagePath,
                playlistUrl,
                durationSeconds,
                sizeBytes: uploadResult?.totalSizeBytes || 0,
                createdAt: new Date(),
            };

            if (session) {
                await this.sessionModel.findByIdAndUpdate(
                    session._id,
                    {
                        $set: { sessionFolder },
                        $push: { recordings: recordingItem },
                    },
                    { new: true }
                );
                this.logger.log(
                    `Đã chèn recording ${recordingItem.recordingId} vào session ${session._id} thành công (R2 path: ${storagePath}).`
                );
            } else {
                this.logger.warn(`Không tìm thấy session tương ứng cho meeting ${meetingCode} để chèn recording.`);
            }
        } catch (error) {
            this.logger.error(`Lỗi xử lý hậu kỳ cho ${meetingCode}:`, error);
        }
    }

    // Helper, utils...

    private async uploadHlsToR2(
        sessionFolder: string,
        recordingFolderName: string,
        hlsDirPath: string
    ): Promise<{ totalSizeBytes: number; fileCount: number }> {
        const s3 = new S3Client({
            region: "auto",
            endpoint: process.env.R2_ENDPOINT_URL,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        });

        let totalSizeBytes = 0;
        let fileCount = 0;

        try {
            const bucketName = process.env.R2_BUCKET_NAME;
            const files = await fs.readdir(hlsDirPath);

            for (const file of files) {
                const filePath = path.join(hlsDirPath, file);
                const fileContent = await fs.readFile(filePath);
                totalSizeBytes += fileContent.length;
                fileCount++;

                // Cấu trúc thư mục trên R2: recordings/sessionFolder/recordingFolder/file
                const s3Key = `recordings/${sessionFolder}/${recordingFolderName}/${file}`;

                await s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: s3Key,
                    Body: fileContent,
                    ContentType: file.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T',
                }));
            }

            this.logger.log(
                `Đã upload toàn bộ file HLS của recording ${recordingFolderName} (session: ${sessionFolder}) lên R2 (${fileCount} files, ${totalSizeBytes} bytes).`
            );

            // Dọn dẹp ổ cứng sau khi upload thành công
            await fs.rm(hlsDirPath, { recursive: true, force: true });
        } catch (error) {
            this.logger.error("Lỗi khi upload lên R2:", error);
        }

        return { totalSizeBytes, fileCount };
    }
}