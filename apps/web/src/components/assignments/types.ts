export interface Attachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

export interface Assignment {
  _id: string;
  title: string;
  description: string;
  roomId: string;
  channelId: string;
  channelIds?: string[];
  deadline: string;
  submissionPolicy: "allow_late" | "lock_after_deadline";
  recipientType: "all_current_and_future" | "specific_members";
  recipientMemberIds?: string[];
  gradingType: "graded" | "ungraded";
  maxScore?: number;
  attachments: Attachment[];
  status: "draft" | "published";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  mySubmission?: Submission | null;
  submissions?: Submission[];
}

export interface Submission {
  _id: string;
  assignmentId: string;
  studentId: string;
  roomId: string;
  channelId: string;
  attachments: Attachment[];
  submittedAt: string;
  submissionStatus: "on_time" | "late";
  lateMinutes: number;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  createdAt: string;
  updatedAt: string;
  comments?: any[];
}
