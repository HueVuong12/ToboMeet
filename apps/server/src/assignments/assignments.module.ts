import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Assignment, AssignmentSchema } from "./schemas/assignment.schema";
import { AssignmentSubmission, AssignmentSubmissionSchema } from "./schemas/submission.schema";
import { AssignmentComment, AssignmentCommentSchema } from "./schemas/assignment-comment.schema";
import { AssignmentsService } from "./assignments.service";
import { AssignmentsController } from "./assignments.controller";
import { AssignmentsGateway } from "./assignments.gateway";
import { RoomsModule } from "../rooms/rooms.module";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import { CoreModule } from "../core/core.module";
import { SupabaseModule } from "../supabase/supabase.module";

import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
      { name: AssignmentSubmission.name, schema: AssignmentSubmissionSchema },
      { name: AssignmentComment.name, schema: AssignmentCommentSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    RoomsModule,
    UsersModule,
    CoreModule,
    SupabaseModule,
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentsGateway],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}

