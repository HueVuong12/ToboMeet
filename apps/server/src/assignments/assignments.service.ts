import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Assignment, AssignmentDocument } from "./schemas/assignment.schema";
import { AssignmentSubmission, AssignmentSubmissionDocument } from "./schemas/submission.schema";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { SubmitAssignmentDto } from "./dto/submit-assignment.dto";
import { GradeSubmissionDto } from "./dto/grade-submission.dto";
import { RoomsService } from "../rooms/rooms.service";
import { AssignmentsGateway } from "./assignments.gateway";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { RoomMember } from "../rooms/schemas/room-member.schema";

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name) private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(AssignmentSubmission.name) private submissionModel: Model<AssignmentSubmissionDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private roomsService: RoomsService,
    private assignmentsGateway: AssignmentsGateway,
  ) {}

  private async verifyUserRole(roomId: string, userId: string): Promise<{ isOwnerOrAdmin: boolean; isMember: boolean }> {
    const room = await this.roomModel.findOne({ _id: roomId, isDeleted: { $ne: true } });
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    const isOwner = room.ownerId === userId;
    const member = room.members?.find((m: RoomMember) => m.userId === userId && m.status === "active");
    const isMember = !!member || isOwner;
    const isOwnerOrAdmin = isOwner || (member && ["owner", "admin"].includes(member.role.toLowerCase()));
    return { isOwnerOrAdmin: !!isOwnerOrAdmin, isMember };
  }

  async create(createDto: CreateAssignmentDto, userId: string) {
    const { isOwnerOrAdmin } = await this.verifyUserRole(createDto.roomId, userId);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Only room owners/teachers can create assignments");
    }

    // Nếu Giao bài (published): Bắt buộc kiểm tra các trường
    if (createDto.status === "published") {
      if (!createDto.title || !createDto.title.trim()) {
        throw new BadRequestException("Assignment title is required when publishing");
      }
      if (!createDto.deadline) {
        throw new BadRequestException("Assignment deadline is required when publishing");
      }
    }

    if (createDto.gradingType === "graded" && (!createDto.maxScore || createDto.maxScore <= 0)) {
      throw new BadRequestException("Max score is required and must be greater than 0 for graded assignments");
    }

    let finalRecipientMemberIds = createDto.recipientMemberIds || [];
    if (createDto.recipientType === "current_members") {
      const room = await this.roomModel.findOne({ _id: createDto.roomId });
      if (room && room.members) {
        finalRecipientMemberIds = room.members
          .filter((m: RoomMember) => m.status === "active")
          .map((m: RoomMember) => m.userId);
      }
    }

    // Tiêu đề mặc định cho bản nháp
    const finalTitle = createDto.title?.trim() || "Untitled Draft";

    const assignment = new this.assignmentModel({
      ...createDto,
      title: finalTitle,
      recipientMemberIds: finalRecipientMemberIds,
      createdBy: userId,
    });
    const saved = await assignment.save();

    if (saved.status === "published") {
      this.assignmentsGateway.notifyAssignmentPublished(saved.roomId, saved.channelId, saved);
    }
    return saved;
  }

  async update(id: string, updateDto: Partial<CreateAssignmentDto>, userId: string) {
    const assignment = await this.assignmentModel.findById(id);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const { isOwnerOrAdmin } = await this.verifyUserRole(assignment.roomId, userId);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Only room owners/teachers can update assignments");
    }

    const wasDraft = assignment.status === "draft";
    Object.assign(assignment, updateDto);

    // Nếu chuyển sang published hoặc update khi published: validate bắt buộc
    if (assignment.status === "published") {
      if (!assignment.title || !assignment.title.trim() || assignment.title === "Untitled Draft") {
        throw new BadRequestException("Assignment title is required when publishing");
      }
      if (!assignment.deadline) {
        throw new BadRequestException("Assignment deadline is required when publishing");
      }
    }

    if (updateDto.recipientType === "current_members") {
      const room = await this.roomModel.findOne({ _id: assignment.roomId });
      if (room && room.members) {
        assignment.recipientMemberIds = room.members
          .filter((m: RoomMember) => m.status === "active")
          .map((m: RoomMember) => m.userId);
      }
    }

    if (assignment.gradingType === "graded" && (!assignment.maxScore || assignment.maxScore <= 0)) {
      throw new BadRequestException("Max score is required and must be greater than 0 for graded assignments");
    }

    const saved = await assignment.save();

    if (wasDraft && saved.status === "published") {
      this.assignmentsGateway.notifyAssignmentPublished(saved.roomId, saved.channelId, saved);
    }
    return saved;
  }

  async delete(id: string, userId: string) {
    const assignment = await this.assignmentModel.findById(id);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const { isOwnerOrAdmin } = await this.verifyUserRole(assignment.roomId, userId);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Only room owners/teachers can delete assignments");
    }

    await this.assignmentModel.findByIdAndDelete(id);
    await this.submissionModel.deleteMany({ assignmentId: id });
    return { success: true };
  }

  async getRoomAssignments(roomId: string, userId: string) {
    const { isOwnerOrAdmin, isMember } = await this.verifyUserRole(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException("You are not a member of this room");
    }

    // Owner/Admin th?y toàn b? (k? c? draft)
    if (isOwnerOrAdmin) {
      return this.assignmentModel.find({ roomId }).sort({ createdAt: -1 }).exec();
    }

    // H?c viên ch? th?y nh?ng bài t?p dã published + th?a mãn d?i tu?ng nh?n
    const assignments = await this.assignmentModel.find({
      roomId,
      status: "published",
    }).sort({ createdAt: -1 }).exec();

    return assignments.filter(item => {
      if (item.recipientType === "current_and_future_members" || item.recipientType === "all_current_and_future") {
        return true;
      }
      return item.recipientMemberIds?.includes(userId);
    });
  }

  async findOne(id: string, userId: string) {
    const assignment = await this.assignmentModel.findById(id);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const { isOwnerOrAdmin, isMember } = await this.verifyUserRole(assignment.roomId, userId);
    if (!isMember) {
      throw new ForbiddenException("You are not a member of this room");
    }

    // Học viên truy cập trực tiếp bằng ID qua URL / API
    if (!isOwnerOrAdmin) {
      if (assignment.status !== "published") {
        throw new ForbiddenException("This assignment is not published yet");
      }
      const isAudience =
        assignment.recipientType === "current_and_future_members" ||
        assignment.recipientType === "all_current_and_future" ||
        assignment.recipientMemberIds?.includes(userId);

      if (!isAudience) {
        throw new ForbiddenException("You are not assigned to this assignment");
      }
    }

    return assignment;
  }

  async submit(assignmentId: string, submitDto: SubmitAssignmentDto, userId: string) {
    const assignment = await this.assignmentModel.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    if (assignment.status !== "published") {
      throw new BadRequestException("This assignment is not published yet");
    }

    const { isOwnerOrAdmin, isMember } = await this.verifyUserRole(assignment.roomId, userId);
    if (!isMember) {
      throw new ForbiddenException("You are not a member of this room");
    }

    // Check recipients
    const isAudience =
      assignment.recipientType === "current_and_future_members" ||
      assignment.recipientType === "all_current_and_future" ||
      assignment.recipientMemberIds?.includes(userId);

    if (!isAudience) {
      throw new ForbiddenException("You are not assigned to this assignment");
    }

    const now = new Date();
    const deadline = new Date(assignment.deadline);

    const isPastDeadline = now.getTime() > deadline.getTime();

    // N?u khóa sau deadline
    if (isPastDeadline && assignment.submissionPolicy === "lock_after_deadline") {
      throw new BadRequestException("Ðã h?t h?n n?p bài");
    }

    // Tính s? phút tr?
    const lateMinutes = isPastDeadline
      ? Math.max(0, Math.floor((now.getTime() - deadline.getTime()) / 60000))
      : 0;

    const submissionStatus = isPastDeadline ? "late" : "on_time";

    // Tìm xem dã n?p chua d? c?p nh?t ho?c t?o m?i
    let submission = await this.submissionModel.findOne({ assignmentId, studentId: userId });

    if (submission) {
      // Cho phép c?p nh?t/n?p l?i
      if (isPastDeadline && assignment.submissionPolicy === "lock_after_deadline") {
        throw new BadRequestException("Ðã h?t h?n n?p bài");
      }
      submission.attachments = submitDto.attachments;
      submission.submittedAt = now;
      submission.submissionStatus = submissionStatus;
      submission.lateMinutes = lateMinutes;
      submission = await submission.save();
    } else {
      submission = new this.submissionModel({
        assignmentId,
        studentId: userId,
        roomId: assignment.roomId,
        channelId: assignment.channelId,
        attachments: submitDto.attachments,
        submittedAt: now,
        submissionStatus,
        lateMinutes,
      });
      submission = await submission.save();
    }

    this.assignmentsGateway.notifyAssignmentSubmitted(assignment.roomId, assignment.channelId, submission);
    return submission;
  }

  async getSubmissions(assignmentId: string, userId: string) {
    const assignment = await this.assignmentModel.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const { isOwnerOrAdmin } = await this.verifyUserRole(assignment.roomId, userId);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Only owners/teachers can view all submissions");
    }

    return this.submissionModel.find({ assignmentId }).exec();
  }

  async getMySubmission(assignmentId: string, userId: string) {
    return this.submissionModel.findOne({ assignmentId, studentId: userId }).exec();
  }

  async grade(submissionId: string, gradeDto: GradeSubmissionDto, userId: string) {
    const submission = await this.submissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    const assignment = await this.assignmentModel.findById(submission.assignmentId);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const { isOwnerOrAdmin } = await this.verifyUserRole(submission.roomId, userId);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException("Only teachers can grade submissions");
    }

    // Validate score
    if (assignment.gradingType === "graded" && gradeDto.score !== undefined) {
      if (gradeDto.score < 0 || (assignment.maxScore !== undefined && gradeDto.score > assignment.maxScore)) {
        throw new BadRequestException(`Score must be between 0 and max score (${assignment.maxScore})`);
      }
    }

    if (gradeDto.score !== undefined) submission.score = gradeDto.score;
    if (gradeDto.feedback !== undefined) submission.feedback = gradeDto.feedback;
    submission.gradedBy = userId;
    submission.gradedAt = new Date();

    const saved = await submission.save();
    this.assignmentsGateway.notifyAssignmentGradingUpdated(submission.roomId, submission.channelId, submission.studentId, saved);
    return saved;
  }
}
