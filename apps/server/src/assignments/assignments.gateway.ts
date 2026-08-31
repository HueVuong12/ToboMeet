import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { AssignmentDocument } from "./schemas/assignment.schema";
import { AssignmentSubmissionDocument } from "./schemas/submission.schema";
import { AssignmentCommentDocument } from "./schemas/assignment-comment.schema";

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  },
})
export class AssignmentsGateway {
  @WebSocketServer()
  server: Server;

  notifyAssignmentPublished(roomId: string, channelId: string, assignment: AssignmentDocument) {
    this.server.to(`room_${roomId}`).emit("assignment_published", {
      roomId,
      channelId,
      assignment,
    });
  }

  notifyAssignmentSubmitted(roomId: string, channelId: string, submission: AssignmentSubmissionDocument) {
    this.server.to(`room_${roomId}`).emit("assignment_submitted", {
      roomId,
      channelId,
      submission,
    });
  }

  notifyAssignmentGradingUpdated(roomId: string, channelId: string, studentId: string, submission: AssignmentSubmissionDocument) {
    this.server.to(`room_${roomId}`).emit("assignment_graded", {
      roomId,
      channelId,
      studentId,
      submission,
    });
  }

  notifyCommentAdded(roomId: string, assignmentId: string, comment: AssignmentCommentDocument) {
    this.server.to(`room_${roomId}`).emit("assignment_comment_added", {
      roomId,
      assignmentId,
      comment,
    });
  }
}

