import { Controller, Post, Put, Delete, Get, Body, Param, UseGuards, Req } from "@nestjs/common";
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
  getRoomAssignments(@Param("roomId") roomId: string, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.getRoomAssignments(roomId, req.user.id);
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
}
