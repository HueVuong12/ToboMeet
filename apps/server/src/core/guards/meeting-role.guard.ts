// src/core/guards/meeting-role.guard.ts
import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Meeting, MeetingDocument } from "../../meetings/schemas/meeting.schema";
import { AppException } from "../exceptions/app.exception";
import { ErrorCode } from "@tobomeet/shared/types";
import { MeetingsService } from "../../meetings/meetings.service";

/**
 * Guard kiểm tra quyền khi thao tác với meeting API.
 * Chỉ phụ thuộc vào meetingCode, dùng chung cho cả personal và channel meeting.
 */
@Injectable()
export class MeetingRoleGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private meetingsService: MeetingsService,
        @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id;

        const meetingCode =
            request.params.code ||
            request.params.meetingCode ||
            request.body?.meetingCode;

        if (!userId || !meetingCode) {
            throw new AppException(ErrorCode.INVALID_PERMISSION);
        }

        const meeting = await this.meetingModel.findOne({ meetingCode }).exec();
        if (!meeting) {
            throw new AppException(ErrorCode.MEETING_NOT_FOUND);
        }

        const { role } = await this.meetingsService.resolveParticipantRole(
            meeting,
            userId,
        );

        // Gắn vào request để controller dùng nếu cần
        request.meetingRole = role;
        request.meeting = meeting;

        // Check required roles từ decorator @Roles(...)
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (requiredRoles?.length > 0 && !requiredRoles.includes(role)) {
            throw new AppException(ErrorCode.INVALID_PERMISSION);
        }

        return true;
    }
}