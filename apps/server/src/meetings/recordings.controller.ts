import {
    Controller,
    Post,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import { RecordingsService } from "./recordings.service";
import { SupabaseGuard } from "../core/guards/supabase.guard";
import { Roles } from "../core/decorators/roles.decorator";
import { MeetingRoleGuard } from "../core/guards/meeting-role.guard";

@Controller("meetings/:code/record")
export class RecordingsController {
    constructor(private readonly recordingsService: RecordingsService) { }

    /**
     * POST /api/meetings/:code/record/start
     * Bắt đầu ghi hình cuộc họp (Chỉ Owner/Admin mới có quyền)
     */
    @Post("start")
    @Roles("owner", "admin")
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(SupabaseGuard, MeetingRoleGuard)
    async startRecording(@Param("code") meetingCode: string): Promise<void> {
        await this.recordingsService.startRecording(meetingCode);
    }

    /**
     * POST /api/meetings/:code/record/stop
     * Dừng ghi hình cuộc họp (Chỉ Owner/Admin mới có quyền)
     */
    @Post("stop")
    @Roles("owner", "admin")
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(SupabaseGuard, MeetingRoleGuard)
    async stopRecording(@Param("code") meetingCode: string): Promise<void> {
        await this.recordingsService.stopRecording(meetingCode);
    }
}