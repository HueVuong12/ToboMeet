import { Controller, Post, Put, Delete, Get, Body, Param, UseGuards, Req, Query } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { SubmitAssignmentDto } from "./dto/submit-assignment.dto";
import { GradeSubmissionDto } from "./dto/grade-submission.dto";
import { SupabaseGuard } from "../core/guards/supabase.guard";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller("assignments")
@UseGuards(SupabaseGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  create(@Body() createDto: CreateAssignmentDto, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.create(createDto, req.user.id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() updateDto: Partial<CreateAssignmentDto>, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.update(id, updateDto, req.user.id);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.delete(id, req.user.id);
  }

  @Get("room/:roomId")
  getRoomAssignments(
    @Param("roomId") roomId: string,
    @Query("status") status: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.assignmentsService.getRoomAssignments(roomId, req.user.id, status);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.findOne(id, req.user.id);
  }

  @Post(":id/submit")
  submit(@Param("id") id: string, @Body() submitDto: SubmitAssignmentDto, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.submit(id, submitDto, req.user.id);
  }

  @Get(":id/submissions")
  getSubmissions(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.getSubmissions(id, req.user.id);
  }

  @Get(":id/my-submission")
  getMySubmission(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.getMySubmission(id, req.user.id);
  }

  @Post("submissions/:submissionId/grade")
  grade(@Param("submissionId") submissionId: string, @Body() gradeDto: GradeSubmissionDto, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.grade(submissionId, gradeDto, req.user.id);
  }

  @Delete(":id/submit")
  deleteSubmission(@Param("id") assignmentId: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.deleteSubmission(assignmentId, req.user.id);
  }

  @Post("submissions/:submissionId/comments")
  addComment(
    @Param("submissionId") submissionId: string,
    @Body("content") content: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.assignmentsService.addComment(submissionId, content, req.user.id);
  }

  @Post(":assignmentId/comments")
  addAssignmentComment(
    @Param("assignmentId") assignmentId: string,
    @Body("content") content: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.assignmentsService.addAssignmentComment(assignmentId, content, req.user.id);
  }

  @Get(":assignmentId/comments")
  getAssignmentComments(
    @Param("assignmentId") assignmentId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.assignmentsService.getAssignmentComments(assignmentId, req.user.id);
  }
}
