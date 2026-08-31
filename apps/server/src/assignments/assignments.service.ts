import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Assignment, AssignmentDocument } from "./schemas/assignment.schema";
import { AssignmentSubmission, AssignmentSubmissionDocument } from "./schemas/submission.schema";
import { AssignmentComment, AssignmentCommentDocument } from "./schemas/assignment-comment.schema";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { SubmitAssignmentDto } from "./dto/submit-assignment.dto";
import { GradeSubmissionDto } from "./dto/grade-submission.dto";
import { RoomsService } from "../rooms/rooms.service";
import { AssignmentsGateway } from "./assignments.gateway";
import { Room, RoomDocument } from "../rooms/schemas/room.schema";
import { RoomMember } from "../rooms/schemas/room-member.schema";
import { UsersService } from "../users/users.service";

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectModel(Assignment.name) private assignmentModel: Model<AssignmentDocument>,
    @InjectModel(AssignmentSubmission.name) private submissionModel: Model<AssignmentSubmissionDocument>,
    @InjectModel(AssignmentComment.name) private commentModel: Model<AssignmentCommentDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private roomsService: RoomsService,
    private assignmentsGateway: AssignmentsGateway,
    private usersService: UsersService,
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
      if (createDto.gradingType === "graded" && (!createDto.maxScore || createDto.maxScore <= 0)) {
        throw new BadRequestException("Max score is required and must be greater than 0 for graded assignments");
      }
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

    if (assignment.status === "draft" && assignment.createdBy !== userId) {
      throw new ForbiddenException("You do not have permission to update this draft");
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
      if (assignment.gradingType === "graded" && (!assignment.maxScore || assignment.maxScore <= 0)) {
        throw new BadRequestException("Max score is required and must be greater than 0 for graded assignments");
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

    if (assignment.status === "draft" && assignment.createdBy !== userId) {
      throw new ForbiddenException("You do not have permission to delete this draft");
    }

    await this.assignmentModel.findByIdAndDelete(id);
    await this.submissionModel.deleteMany({ assignmentId: id });
    return { success: true };
  }

  async getRoomAssignments(roomId: string, userId: string, status?: string) {
    const { isOwnerOrAdmin, isMember } = await this.verifyUserRole(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException("You are not a member of this room");
    }

    const query: any = { roomId };
    if (status) {
      query.status = status;
      if (status === "draft") {
        query.createdBy = userId;
      }
    }

    // Owner/Admin thấy toàn bộ (kể cả draft nếu không truyền status lọc cụ thể)
    if (isOwnerOrAdmin) {
      const assignments = await this.assignmentModel.find(query).sort({ createdAt: -1 }).exec();
      const roomSubmissions = await this.submissionModel.find({ roomId }).exec();

      const submissionsMap = new Map<string, any[]>();
      for (const sub of roomSubmissions) {
        const list = submissionsMap.get(sub.assignmentId.toString()) || [];
        list.push(sub);
        submissionsMap.set(sub.assignmentId.toString(), list);
      }

      return assignments.map(item => {
        const itemObj = item.toObject() as any;
        itemObj.submissions = submissionsMap.get(item._id.toString()) || [];
        return itemObj;
      });
    }

    // Học viên không được phép xem các bài tập draft
    if (status === "draft") {
      throw new ForbiddenException("Members cannot view draft assignments");
    }

    query.status = "published";
    const assignments = await this.assignmentModel.find(query).sort({ createdAt: -1 }).exec();
    const userSubmissions = await this.submissionModel.find({ roomId, studentId: userId }).exec();

    const mySubmissionsMap = new Map(userSubmissions.map(s => [s.assignmentId.toString(), s]));

    const filtered = assignments.filter(item => {
      if (item.recipientType === "current_and_future_members" || item.recipientType === "all_current_and_future") {
        return true;
      }
      return item.recipientMemberIds?.includes(userId);
    });

    return filtered.map(item => {
      const itemObj = item.toObject() as any;
      itemObj.mySubmission = mySubmissionsMap.get(item._id.toString()) || null;
      return itemObj;
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

    if (assignment.status === "draft") {
      if (assignment.createdBy !== userId) {
        throw new ForbiddenException("You do not have permission to view this draft");
      }
    } else {
      // Học viên truy cập trực tiếp bằng ID qua URL / API
      if (!isOwnerOrAdmin) {
        const isAudience =
          assignment.recipientType === "current_and_future_members" ||
          assignment.recipientType === "all_current_and_future" ||
          assignment.recipientMemberIds?.includes(userId);

        if (!isAudience) {
          throw new ForbiddenException("You are not assigned to this assignment");
        }
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

    // Tìm xem đã nộp chưa để cập nhật hoặc tạo mới
    let submission = await this.submissionModel.findOne({ assignmentId, studentId: userId });

    if (submission) {
      // Cho phép cập nhật/nộp lại
      if (isPastDeadline && assignment.submissionPolicy === "lock_after_deadline") {
        throw new BadRequestException("Đã hết hạn nộp bài");
      }

      const existingAttachmentsMap = new Map(
        (submission.attachments || []).map((att: any) => [att.url, att.uploadedAt || submission.submittedAt || now])
      );

      const updatedAttachments = submitDto.attachments.map((att: any) => ({
        name: att.name,
        url: att.url,
        size: att.size,
        type: att.type,
        uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : (existingAttachmentsMap.get(att.url) || now),
      }));

      submission.attachments = updatedAttachments;
      submission.submittedAt = now;
      submission.submissionStatus = submissionStatus;
      submission.lateMinutes = lateMinutes;
      submission = await submission.save();
    } else {
      const formattedAttachments = submitDto.attachments.map((att: any) => ({
        name: att.name,
        url: att.url,
        size: att.size,
        type: att.type,
        uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : now,
      }));

      submission = new this.submissionModel({
        assignmentId,
        studentId: userId,
        roomId: assignment.roomId,
        channelId: assignment.channelId,
        attachments: formattedAttachments,
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

  async deleteSubmission(assignmentId: string, userId: string) {
    const submission = await this.submissionModel.findOne({ assignmentId, studentId: userId });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    if (submission.score !== undefined) {
      throw new BadRequestException("Cannot delete a graded submission");
    }

    await this.submissionModel.deleteOne({ _id: submission._id });
    return { success: true };
  }

  async addComment(submissionId: string, content: string, userId: string) {
    const submission = await this.submissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    const user = await this.usersService.findBySupabaseId(userId);
    const userName = user?.displayName || "Thành viên";

    if (!submission.comments) {
      (submission as any).comments = [];
    }

    submission.comments.push({
      userId,
      userName,
      content,
      createdAt: new Date(),
    });

    return submission.save();
  }

  async addAssignmentComment(assignmentId: string, content: string, userId: string) {
    const assignment = await this.assignmentModel.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const room = await this.roomModel.findOne({ _id: assignment.roomId, isDeleted: { $ne: true } });
    if (!room) {
      throw new NotFoundException("Room not found");
    }

    const user = await this.usersService.findBySupabaseId(userId);
    const userName = user?.displayName || "Thành viên";

    // Tìm role của user trong room
    const isOwner = room.ownerId === userId;
    const member = room.members?.find((m: RoomMember) => m.userId === userId && m.status === "active");
    if (!isOwner && !member) {
      throw new ForbiddenException("You are not a member of this room");
    }

    const role = isOwner ? "owner" : (member?.role || "member");

    const comment = new this.commentModel({
      assignmentId,
      roomId: assignment.roomId,
      userId,
      userName,
      role,
      content,
    });

    const saved = await comment.save();

    // Phát socket realtime
    this.assignmentsGateway.notifyCommentAdded(assignment.roomId, assignmentId, saved);

    return saved;
  }

  async getAssignmentComments(assignmentId: string, userId: string) {
    const assignment = await this.assignmentModel.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    const { isMember } = await this.verifyUserRole(assignment.roomId, userId);
    if (!isMember) {
      throw new ForbiddenException("You are not a member of this room");
    }

    return this.commentModel.find({ assignmentId }).sort({ createdAt: 1 }).exec();
  }
}
