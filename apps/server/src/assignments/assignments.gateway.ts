import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
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

  @SubscribeMessage("join_room")
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (roomId) {
      client.join(`room_${roomId}`);
      client.join(roomId);
      console.log(`[AssignmentsGateway] Client ${client.id} joined room_${roomId} & ${roomId}`);
    }
  }

  notifyAssignmentCreated(roomId: string, channelId: string, assignment: AssignmentDocument) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      assignment,
      assignmentId: String(assignment._id),
      _id: String(assignment._id),
    };
    this.server.to(`room_${roomId}`).emit("assignment_created", payload);
    if (roomId) this.server.to(roomId).emit("assignment_created", payload);
    this.server.emit("assignment_created", payload);
  }

  notifyAssignmentPublished(roomId: string, channelId: string, assignment: AssignmentDocument) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      assignment,
      assignmentId: String(assignment._id),
      _id: String(assignment._id),
    };
    this.server.to(`room_${roomId}`).emit("assignment_published", payload);
    if (roomId) this.server.to(roomId).emit("assignment_published", payload);
    this.server.emit("assignment_published", payload);
  }

  notifyAssignmentUpdated(roomId: string, channelId: string, assignment: AssignmentDocument) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      assignment,
      assignmentId: String(assignment._id),
      _id: String(assignment._id),
    };
    this.server.to(`room_${roomId}`).emit("assignment_updated", payload);
    if (roomId) this.server.to(roomId).emit("assignment_updated", payload);
    this.server.emit("assignment_updated", payload);
  }

  notifyAssignmentDeleted(roomId: string, channelId: string, assignmentId: string) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      assignmentId: String(assignmentId),
      _id: String(assignmentId),
    };
    this.server.to(`room_${roomId}`).emit("assignment_deleted", payload);
    if (roomId) this.server.to(roomId).emit("assignment_deleted", payload);
    this.server.emit("assignment_deleted", payload);
  }

  notifyAssignmentSubmitted(roomId: string, channelId: string, submission: AssignmentSubmissionDocument) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      submission,
      assignmentId: String(submission.assignmentId),
      studentId: String(submission.studentId),
    };
    this.server.to(`room_${roomId}`).emit("assignment_submitted", payload);
    if (roomId) this.server.to(roomId).emit("assignment_submitted", payload);
    this.server.emit("assignment_submitted", payload);
  }

  notifySubmissionDeleted(
    roomId: string,
    channelId: string,
    assignmentId: string,
    submissionId: string,
    studentId: string
  ) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      assignmentId: String(assignmentId),
      submissionId: String(submissionId),
      studentId: String(studentId),
    };
    console.log("[BACKEND] emit assignment_submission_deleted:", payload);
    this.server.to(`room_${roomId}`).emit("assignment_submission_deleted", payload);
    if (roomId) this.server.to(roomId).emit("assignment_submission_deleted", payload);
    this.server.emit("assignment_submission_deleted", payload);
  }

  notifyAssignmentGradingUpdated(roomId: string, channelId: string, studentId: string, submission: AssignmentSubmissionDocument) {
    const payload = {
      roomId: String(roomId),
      channelId: String(channelId || ""),
      studentId: String(studentId),
      submission,
      assignmentId: String(submission.assignmentId),
    };
    this.server.to(`room_${roomId}`).emit("assignment_graded", payload);
    if (roomId) this.server.to(roomId).emit("assignment_graded", payload);
    this.server.emit("assignment_graded", payload);
  }

  notifyCommentAdded(roomId: string, assignmentId: string, comment: AssignmentCommentDocument) {
    const payload = {
      roomId: String(roomId),
      assignmentId: String(assignmentId),
      comment,
    };
    this.server.to(`room_${roomId}`).emit("assignment_comment_added", payload);
    if (roomId) this.server.to(roomId).emit("assignment_comment_added", payload);
    this.server.emit("assignment_comment_added", payload);
  }

  notifyCommentDeleted(roomId: string, assignmentId: string, commentId: string) {
    const payload = {
      roomId: String(roomId),
      assignmentId: String(assignmentId),
      commentId: String(commentId),
    };
    this.server.to(`room_${roomId}`).emit("assignment_comment_deleted", payload);
    if (roomId) this.server.to(roomId).emit("assignment_comment_deleted", payload);
    this.server.emit("assignment_comment_deleted", payload);
  }
}

