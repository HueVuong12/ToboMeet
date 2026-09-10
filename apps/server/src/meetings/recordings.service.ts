import { Injectable, Logger } from "@nestjs/common";
import { RoomServiceClient } from "livekit-server-sdk";
import { AppException } from "../core/exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import {
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    DeleteObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import {
    MeetingSession,
    MeetingSessionDocument,
} from "./schemas/meeting-session.schema";
import {
    RecordingWebhookDto,
    TimelineData,
    TimelineSegmentAudio,
    TimelineSegmentScreen,
} from "@tobomeet/shared/types";

const execFilePromise = promisify(execFile);

@Injectable()
export class RecordingsService {
    private livekitRoomService?: RoomServiceClient;
    private readonly logger = new Logger(RecordingsService.name);

    constructor(
        @InjectModel(MeetingSession.name)
        private sessionModel: Model<MeetingSessionDocument>,
    ) {
        const livekitHost = process.env.LIVEKIT_API_URL;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (livekitHost && apiKey && apiSecret) {
            this.livekitRoomService = new RoomServiceClient(livekitHost, apiKey, apiSecret);
        }
    }

    /**
     * Trích xuất sessionId từ LiveKit room metadata hoặc query MongoDB
     */
    private async extractSessionId(meetingCode: string): Promise<string> {
        if (this.livekitRoomService) {
            try {
                const rooms = await this.livekitRoomService.listRooms([meetingCode]);
                if (rooms && rooms.length > 0 && rooms[0].metadata) {
                    const meta = JSON.parse(rooms[0].metadata);
                    if (meta.sessionId) return meta.sessionId;
                }
            } catch (error) {
                this.logger.warn(`Không thể đọc metadata từ LiveKit room ${meetingCode}:`, error);
            }
        }

        try {
            const ongoingSession = await this.sessionModel
                .findOne({ meetingCode, status: "ongoing" })
                .sort({ createdAt: -1 });
            if (ongoingSession) {
                return ongoingSession._id.toString();
            }

            const latestSession = await this.sessionModel
                .findOne({ meetingCode })
                .sort({ createdAt: -1 });
            if (latestSession) {
                return latestSession._id.toString();
            }
        } catch (error) {
            this.logger.error(`Lỗi query session cho meetingCode ${meetingCode}:`, error);
        }

        return "";
    }

    /**
     * Bắt đầu ghi hình cuộc họp bằng cách gọi Python Recorder Bot Service
     */
    async startRecording(meetingCode: string): Promise<void> {
        const sessionId = await this.extractSessionId(meetingCode);
        const botUrl = process.env.RECORDER_BOT_URL || "http://localhost:8000";

        this.logger.log(
            `[startRecording] Gửi yêu cầu bắt đầu ghi hình tới Recorder Bot cho room: ${meetingCode}, sessionId: ${sessionId}`,
        );

        try {
            const response = await fetch(`${botUrl.replace(/\/$/, "")}/recordings/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    room_name: meetingCode,
                    session_id: sessionId || undefined,
                }),
            });

            if (!response.ok) {
                if (response.status === 409) {
                    this.logger.warn(`[startRecording] Phòng ${meetingCode} hiện đang được ghi hình.`);
                    return;
                }
                const errorData = await response.json().catch(() => ({}));
                this.logger.error(
                    `[startRecording] Recorder Bot trả về lỗi (${response.status}):`,
                    errorData,
                );
                throw new AppException(ErrorCode.SERVER_ERROR);
            }

            this.logger.log(`[startRecording] Đã kích hoạt Recorder Bot thành công cho phòng ${meetingCode}`);
        } catch (error) {
            if (error instanceof AppException) throw error;
            this.logger.error(`[startRecording] Lỗi kết nối tới Recorder Bot:`, error);
            throw new AppException(ErrorCode.SERVER_ERROR);
        }
    }

    /**
     * Dừng ghi hình cuộc họp bằng cách gọi Python Recorder Bot Service
     */
    async stopRecording(meetingCode: string): Promise<void> {
        const botUrl = process.env.RECORDER_BOT_URL || "http://localhost:8000";

        this.logger.log(`[stopRecording] Gửi yêu cầu dừng ghi hình tới Recorder Bot cho room: ${meetingCode}`);

        try {
            const response = await fetch(`${botUrl.replace(/\/$/, "")}/recordings/stop`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    room_name: meetingCode,
                }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    this.logger.warn(`[stopRecording] Không có phiên ghi hình nào đang hoạt động cho phòng ${meetingCode}.`);
                    return;
                }
                const errorData = await response.json().catch(() => ({}));
                this.logger.error(
                    `[stopRecording] Recorder Bot trả về lỗi (${response.status}):`,
                    errorData,
                );
                throw new AppException(ErrorCode.SERVER_ERROR);
            }

            this.logger.log(`[stopRecording] Đã yêu cầu dừng Recorder Bot thành công cho phòng ${meetingCode}`);
        } catch (error) {
            if (error instanceof AppException) throw error;
            this.logger.error(`[stopRecording] Lỗi kết nối tới Recorder Bot:`, error);
            throw new AppException(ErrorCode.SERVER_ERROR);
        }
    }


    /**
     * (Worker) Xử lý hậu kì bản ghi cuộc họp nhận từ Webhook của Recorder Bot Python
     */
    async handleWebhookPostProcessing(payload: RecordingWebhookDto): Promise<void> {
        const { room_name, session_id, folder, r2 } = payload;

        const sessionFolder = session_id || room_name;
        // Chuẩn hoá folder prefix từ webhook (ưu tiên r2.folder_prefix, sau đó đến folder)
        const folderPrefix = (r2?.folder_prefix || folder || `recordings/${room_name}/${sessionFolder}`)
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");

        // Tạo thư mục tạm cô lập để xử lý job này
        const tempId = crypto.randomUUID();
        const sessionDir = path.resolve(
            process.env.RECORDING_STORAGE_PATH || path.join(process.cwd(), "recordings"),
            "temp",
            `job_${sessionFolder}_${tempId}`
        );

        try {
            await fs.mkdir(sessionDir, { recursive: true });
            this.logger.log(`[Webhook Post-Processing] Thư mục làm việc tạm: ${sessionDir}`);

            // Tải timeline.json trực tiếp từ Cloudflare R2
            const timelinePath = path.join(sessionDir, "timeline.json");
            const bucketName = r2?.bucket_name || process.env.R2_BUCKET_NAME || "";
            const s3 = this.getR2Client(r2?.endpoint_url);
            const timelineKey = r2?.timeline_key || `${folderPrefix}/timeline.json`;

            const downloadedTimeline = await this.downloadFromR2(s3, bucketName, timelineKey, timelinePath);
            if (!downloadedTimeline) {
                this.logger.error(`[Webhook Post-Processing] Không thể tải timeline.json từ R2 (key: ${timelineKey}). Hủy xử lý.`);
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
                return;
            }

            let timeline: TimelineData;
            try {
                const rawContent = await fs.readFile(timelinePath, "utf8");
                timeline = JSON.parse(rawContent);
            } catch (err) {
                this.logger.error(`[Webhook Post-Processing] Không thể đọc/parse timeline.json tại ${timelinePath}:`, err);
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
                return;
            }

            const audioSegments = timeline.audio_segments || [];
            const screenSegments = timeline.screen_segments || [];

            if (audioSegments.length === 0 && screenSegments.length === 0) {
                this.logger.error(`[Webhook Post-Processing] Không tìm thấy segment media nào trong timeline.json tại ${sessionDir}`);
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
                return;
            }

            // Tải toàn bộ các file media thô (audio/screen) được liệt kê trong timeline từ R2 về thư mục tạm
            const allFilesToCheck = [
                ...audioSegments.map((s) => s.file),
                ...screenSegments.filter((s) => !!s.file).map((s) => s.file),
            ];

            for (const fileName of allFilesToCheck) {
                if (!fileName) continue;
                const localFilePath = path.join(sessionDir, fileName);
                const s3Key = `${folderPrefix}/${fileName}`;
                this.logger.log(`[Webhook Post-Processing] Tải file thô từ R2 (${s3Key})...`);
                const ok = await this.downloadFromR2(s3, bucketName, s3Key, localFilePath);
                if (!ok) {
                    this.logger.warn(`[Webhook Post-Processing] Không thể tải file ${fileName} từ R2 (${s3Key})`);
                }
            }

            const allStarts = [
                ...audioSegments.map((s) => s.start),
                ...screenSegments.filter((s) => !!s.file).map((s) => s.start),
            ];
            const globalT0 = allStarts.length > 0 ? Math.min(...allStarts) : 0.0;
            this.logger.log(`[Webhook Post-Processing] global_t0 = ${globalT0.toFixed(3)}s`);

            // Input 0: Nền đen 1920x1080 r30
            const ffmpegArgs: string[] = [
                "-y",
                "-f", "lavfi",
                "-i", "color=c=black:s=1920x1080:r=30",
            ];

            // Input 1..N: Audio WAV inputs
            const audioInputIndices: { idx: number; seg: TimelineSegmentAudio }[] = [];
            let currentInputIdx = 1;

            for (const seg of audioSegments) {
                const audioFile = path.join(sessionDir, seg.file);
                try {
                    await fs.access(audioFile);
                    ffmpegArgs.push("-i", audioFile);
                    audioInputIndices.push({ idx: currentInputIdx, seg });
                    currentInputIdx++;
                } catch {
                    this.logger.warn(`[Webhook Post-Processing] File audio không tồn tại: ${audioFile}, bỏ qua.`);
                }
            }

            // Input N+1..M: Screen WebM inputs
            const screenInputIndices: {
                idx: number;
                seg: TimelineSegmentScreen;
                startOffset: number;
                endOffset: number;
            }[] = [];

            for (const seg of screenSegments) {
                if (!seg.file) continue;
                const screenFile = path.join(sessionDir, seg.file);
                try {
                    await fs.access(screenFile);
                } catch {
                    this.logger.warn(`[Webhook Post-Processing] File screen không tồn tại: ${screenFile}, bỏ qua.`);
                    continue;
                }

                const realDur = await this.getRealDuration(screenFile);
                const startOffset = Math.max(0.0, seg.start - globalT0);
                const endOffset = realDur ? startOffset + realDur : Math.max(startOffset, seg.end - globalT0);

                ffmpegArgs.push("-i", screenFile);
                screenInputIndices.push({
                    idx: currentInputIdx,
                    seg,
                    startOffset,
                    endOffset,
                });
                currentInputIdx++;
            }

            if (audioInputIndices.length === 0 && screenInputIndices.length === 0) {
                this.logger.error("[Webhook Post-Processing] Không có file media hợp lệ nào để ghép.");
                await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
                return;
            }

            // Xây dựng filter_complex
            const filterParts: string[] = [];
            let lastVideoOut = "0:v";

            // Overlay từng đoạn screen
            for (const item of screenInputIndices) {
                const shiftedLabel = `shifted${item.idx}`;
                const overlayLabel = `vout${item.idx}`;

                filterParts.push(
                    `[${item.idx}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=(PTS-STARTPTS)+${item.startOffset.toFixed(3)}/TB[${shiftedLabel}]`
                );
                filterParts.push(
                    `[${lastVideoOut}][${shiftedLabel}]overlay=x=0:y=0:enable='between(t,${item.startOffset.toFixed(3)},${item.endOffset.toFixed(3)})'[${overlayLabel}]`
                );
                lastVideoOut = overlayLabel;
            }

            // Delay & mix audio
            const delayedAudioLabels: string[] = [];
            for (const item of audioInputIndices) {
                const audioDelayMs = Math.max(0.0, (item.seg.start - globalT0) * 1000);
                const delayedLabel = `adelayed${item.idx}`;
                if (audioDelayMs > 0) {
                    filterParts.push(
                        `[${item.idx}:a]adelay=${Math.round(audioDelayMs)}:all=1[${delayedLabel}]`
                    );
                    delayedAudioLabels.push(`[${delayedLabel}]`);
                } else {
                    delayedAudioLabels.push(`[${item.idx}:a]`);
                }
            }

            let audioMap: string | null = null;
            if (delayedAudioLabels.length > 1) {
                const audioInputsStr = delayedAudioLabels.join("");
                filterParts.push(
                    `${audioInputsStr}amix=inputs=${delayedAudioLabels.length}:duration=longest[aout]`
                );
                audioMap = "[aout]";
            } else if (delayedAudioLabels.length === 1) {
                const label = delayedAudioLabels[0];
                if (label.includes("adelayed")) {
                    audioMap = label;
                } else {
                    audioMap = `${audioInputIndices[0].idx}:a`;
                }
            }

            if (filterParts.length > 0) {
                ffmpegArgs.push("-filter_complex", filterParts.join(";"));
                ffmpegArgs.push("-map", `[${lastVideoOut}]`);
            } else {
                ffmpegArgs.push("-map", "0:v");
            }

            if (audioMap) {
                ffmpegArgs.push("-map", audioMap);
            }

            const tempOutputMp4Path = path.join(sessionDir, "temp_output.mp4");
            ffmpegArgs.push(
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-r", "30",
                "-crf", "23",
                "-c:a", "aac",
                "-shortest",
                tempOutputMp4Path
            );

            this.logger.log(`[Webhook Post-Processing] Bắt đầu chạy FFmpeg tạo ${tempOutputMp4Path}...`);
            await execFilePromise("ffmpeg", ffmpegArgs);
            this.logger.log(`[Webhook Post-Processing] Ghép video FFmpeg thành công: ${tempOutputMp4Path}`);

            // Đóng gói sang playlist HLS (index.m3u8 + segments)
            const hlsOutputDir = path.join(sessionDir, "hls");
            await fs.mkdir(hlsOutputDir, { recursive: true });

            const hlsPlaylistPath = path.join(hlsOutputDir, "index.m3u8");
            const hlsSegmentPattern = path.join(hlsOutputDir, "segment_%03d.ts");

            await execFilePromise("ffmpeg", [
                "-y",
                "-i", tempOutputMp4Path,
                "-c", "copy",
                "-f", "hls",
                "-hls_time", "10",
                "-hls_list_size", "0",
                "-hls_segment_filename", hlsSegmentPattern,
                hlsPlaylistPath,
            ]);

            // Tính thời lượng thực tế
            let durationSeconds = payload.duration_sec || (timeline.duration_sec ? Math.round(timeline.duration_sec) : 0);
            const realDuration = await this.getRealDuration(tempOutputMp4Path);
            if (realDuration) {
                durationSeconds = Math.round(realDuration);
            }

            // Xoá toàn bộ file trong thư mục prefix trên R2 trước khi upload file HLS cuối cùng
            this.logger.log(`[Webhook Post-Processing] Xoá toàn bộ file thô tại prefix R2: "${folderPrefix}" trước khi upload HLS...`);
            await this.deleteFolderFromR2(s3, bucketName, folderPrefix);

            // Đẩy thẳng toàn bộ thư mục HLS lên Cloudflare R2 theo đúng folder prefix nhận được từ webhook
            this.logger.log(`[Webhook Post-Processing] Upload toàn bộ file HLS trực tiếp lên R2 prefix: "${folderPrefix}"...`);
            const uploadResult = await this.uploadFolderToR2(
                folderPrefix,
                hlsOutputDir,
                r2?.endpoint_url,
                r2?.bucket_name
            );

            // Dọn dẹp toàn bộ thư mục tạm trên local sau khi hoàn tất upload
            await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);

            // Cập nhật metadata bản ghi vào MongoDB MeetingSession
            const storagePath = `${folderPrefix}/index.m3u8`;
            const r2PublicUrl = r2?.public_base_url || process.env.R2_PUBLIC_URL || "";
            const playlistUrl = r2PublicUrl
                ? `${r2PublicUrl.replace(/\/$/, "")}/${storagePath}`
                : storagePath;

            const folderName = folderPrefix.split("/").pop() || sessionFolder;

            const recordingItem = {
                recordingId: crypto.randomUUID(),
                folderName,
                storagePath,
                playlistUrl,
                durationSeconds,
                sizeBytes: uploadResult?.totalSizeBytes || 0,
                createdAt: new Date(),
            };

            let sessionDoc = null;
            if (session_id && mongoose.Types.ObjectId.isValid(session_id)) {
                sessionDoc = await this.sessionModel.findById(session_id);
            }
            if (!sessionDoc && session_id) {
                sessionDoc = await this.sessionModel.findOne({ sessionFolder: session_id });
            }
            if (!sessionDoc && room_name) {
                sessionDoc = await this.sessionModel.findOne({ meetingCode: room_name, status: "ongoing" });
            }
            if (!sessionDoc && room_name) {
                sessionDoc = await this.sessionModel.findOne({ meetingCode: room_name }).sort({ createdAt: -1 });
            }

            if (sessionDoc) {
                sessionDoc.recordings.push(recordingItem as any);
                if (!sessionDoc.sessionFolder) {
                    sessionDoc.sessionFolder = sessionFolder;
                }
                await sessionDoc.save();
                this.logger.log(
                    `[Webhook Post-Processing] Đã lưu recording ${recordingItem.recordingId} vào session ${sessionDoc._id} (meetingCode: ${sessionDoc.meetingCode})`,
                );
            } else {
                const newSession = await this.sessionModel.create({
                    meetingCode: room_name || "default_meeting",
                    status: "ended",
                    sessionFolder,
                    recordings: [recordingItem],
                    startedAt: new Date(Date.now() - durationSeconds * 1000),
                    endedAt: new Date(),
                });
                this.logger.log(
                    `[Webhook Post-Processing] Đã tạo mới session ${newSession._id} cho meeting ${room_name} chứa recording ${recordingItem.recordingId}`,
                );
            }
        } catch (error) {
            this.logger.error(`[Webhook Post-Processing] Lỗi trong quá trình xử lý hậu kì cho ${room_name}:`, error);
            await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
        }
    }

    // Helper, utils...

    private getR2Client(customEndpoint?: string): S3Client {
        return new S3Client({
            region: "auto",
            endpoint: customEndpoint || process.env.R2_ENDPOINT_URL,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        });
    }

    private async downloadFromR2(
        s3: S3Client,
        bucketName: string,
        key: string,
        destPath: string,
    ): Promise<boolean> {
        try {
            const cleanKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
            const res = await s3.send(
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: cleanKey,
                }),
            );
            if (!res.Body) return false;
            const bytes = await res.Body.transformToByteArray();
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await fs.writeFile(destPath, Buffer.from(bytes));
            return true;
        } catch (err) {
            this.logger.error(`Lỗi khi tải file ${key} từ R2 (bucket: ${bucketName}):`, err);
            return false;
        }
    }

    private async getRealDuration(filepath: string): Promise<number | null> {
        try {
            const { stdout } = await execFilePromise("ffprobe", [
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                filepath,
            ]);
            const val = parseFloat(stdout.trim());
            return !isNaN(val) && val > 0 ? val : null;
        } catch {
            return null;
        }
    }

    private async deleteFolderFromR2(
        s3: S3Client,
        bucketName: string,
        folderPrefix: string,
    ): Promise<number> {
        const cleanPrefix = folderPrefix.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        if (!cleanPrefix) {
            this.logger.warn("[deleteFolderFromR2] Prefix rỗng, bỏ qua để tránh xoá toàn bộ bucket!");
            return 0;
        }

        const prefixWithSlash = `${cleanPrefix}/`;
        let deletedCount = 0;
        let continuationToken: string | undefined = undefined;

        this.logger.log(`[R2] Bắt đầu xoá toàn bộ file trong prefix: ${prefixWithSlash}`);

        try {
            do {
                const listRes = await s3.send(
                    new ListObjectsV2Command({
                        Bucket: bucketName,
                        Prefix: cleanPrefix,
                        ContinuationToken: continuationToken,
                    }),
                );

                const objectsToDelete = (listRes.Contents || [])
                    .filter(
                        (item) =>
                            item.Key &&
                            (item.Key === cleanPrefix || item.Key.startsWith(prefixWithSlash)),
                    )
                    .map((item) => ({ Key: item.Key! }));

                if (objectsToDelete.length > 0) {
                    try {
                        await s3.send(
                            new DeleteObjectsCommand({
                                Bucket: bucketName,
                                Delete: {
                                    Objects: objectsToDelete,
                                    Quiet: true,
                                },
                            }),
                        );
                    } catch (batchErr: any) {
                        this.logger.warn(
                            `[R2] DeleteObjectsCommand thất bại, xoá từng file bằng DeleteObjectCommand: ${batchErr?.message || batchErr}`,
                        );
                        for (const obj of objectsToDelete) {
                            await s3
                                .send(
                                    new DeleteObjectCommand({
                                        Bucket: bucketName,
                                        Key: obj.Key,
                                    }),
                                )
                                .catch((err) =>
                                    this.logger.warn(
                                        `[R2] Không thể xoá key ${obj.Key}: ${err?.message || err}`,
                                    ),
                                );
                        }
                    }
                    deletedCount += objectsToDelete.length;
                    this.logger.log(`[R2] Đã xoá ${objectsToDelete.length} files trong ${cleanPrefix}`);
                }

                continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
            } while (continuationToken);

            this.logger.log(
                `[R2] Hoàn tất xoá tổng cộng ${deletedCount} files trong prefix: ${cleanPrefix}`,
            );
        } catch (error) {
            this.logger.error(`[R2] Lỗi khi xoá files trong prefix ${cleanPrefix}:`, error);
        }

        return deletedCount;
    }

    private async uploadFolderToR2(
        targetFolderPrefix: string,
        localDirPath: string,
        customEndpoint?: string,
        customBucket?: string,
    ): Promise<{ totalSizeBytes: number; fileCount: number }> {
        const s3 = this.getR2Client(customEndpoint);

        let totalSizeBytes = 0;
        let fileCount = 0;

        const cleanPrefix = targetFolderPrefix.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

        try {
            const bucketName = customBucket || process.env.R2_BUCKET_NAME;
            const files = await fs.readdir(localDirPath);

            for (const file of files) {
                const filePath = path.join(localDirPath, file);
                const fileStat = await fs.stat(filePath);
                if (fileStat.isDirectory()) continue;

                const fileContent = await fs.readFile(filePath);
                totalSizeBytes += fileContent.length;
                fileCount++;

                const s3Key = `${cleanPrefix}/${file}`;

                let contentType = "application/octet-stream";
                if (file.endsWith(".m3u8")) contentType = "application/x-mpegURL";
                else if (file.endsWith(".ts")) contentType = "video/MP2T";
                else if (file.endsWith(".mp4")) contentType = "video/mp4";
                else if (file.endsWith(".webm")) contentType = "video/webm";
                else if (file.endsWith(".json")) contentType = "application/json";

                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucketName,
                        Key: s3Key,
                        Body: fileContent,
                        ContentType: contentType,
                    }),
                );
            }

            this.logger.log(
                `Đã upload toàn bộ file vào R2 prefix "${cleanPrefix}" (${fileCount} files, ${totalSizeBytes} bytes).`
            );

            // Dọn dẹp thư mục local sau khi upload thành công
            await fs.rm(localDirPath, { recursive: true, force: true });
        } catch (error) {
            this.logger.error(`Lỗi khi upload lên R2 prefix "${cleanPrefix}":`, error);
        }

        return { totalSizeBytes, fileCount };
    }
}
