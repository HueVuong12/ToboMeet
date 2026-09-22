export interface Attachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

// ─── Quiz Types ───────────────────────────────────────────────────────────────

export interface QuizOption {
  _id: string;
  text: string;
  /** Chỉ có khi trưởng nhóm xem hoặc sau closeDate + showResultsAfterSubmit */
  isCorrect?: boolean;
}

export interface QuizQuestion {
  _id: string;
  questionType: "choice" | "text";
  title: string;
  points: number;
  isRequired: boolean;
  shuffleOptions: boolean;
  allowMultiple: boolean;
  options: QuizOption[];
}

export interface QuizSettings {
  timeLimitMinutes: number;
  passScore: number;
  shuffleQuestions: boolean;
  showResultsAfterSubmit: boolean;
  acceptingResponses: boolean;
  startDate?: string | null;
  endDate?: string | null;
  closeDate?: string | null;
  accessControl: "anyone" | "organization" | "specific_members";
}

export interface QuizAnswer {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string;
}

// ─── Assignment (extended) ────────────────────────────────────────────────────

export interface Assignment {
  _id: string;
  title: string;
  description: string;
  roomId: string;
  channelId: string;
  channelIds?: string[];
  deadline: string;
  submissionPolicy: "allow_late" | "lock_after_deadline";
  recipientType: "all_current_and_future" | "current_members" | "specific_members";
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
  /** Loại bài: "assignment" | "quiz" (mặc định "assignment") */
  type?: "assignment" | "quiz";
  questions?: QuizQuestion[];
  quizSettings?: QuizSettings | null;
}

// ─── Submission (extended) ────────────────────────────────────────────────────

export interface Submission {
  _id: string;
  assignmentId: string;
  studentId: string;
  roomId: string;
  channelId: string;
  attachments: Attachment[];
  submittedAt?: string;
  submissionStatus?: "on_time" | "late" | "not_submitted" | string;
  lateMinutes: number;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  createdAt: string;
  updatedAt: string;
  comments?: AssignmentCommentItem[];
  /** Quiz fields */
  startedAt?: string;
  shuffleSeed?: string;
  quizAnswers?: QuizAnswer[];
  quizScore?: number;
  gradingStatus?: "auto_graded" | "pending_manual" | "graded" | null;
}

export interface AssignmentCommentItem {
  _id?: string;
  userId: string;
  userName: string;
  role?: string;
  content: string;
  createdAt: string;
  memberId?: string;
  submissionId?: string;
  avatarUrl?: string;
}

// ─── Quiz Attempt (response từ startQuiz / getMyQuizAttempt) ─────────────────

export interface QuizAttemptResponse {
  submission: {
    _id: string;
    startedAt?: string;
    shuffleSeed?: string;
    quizAnswers: QuizAnswer[];
    submittedAt?: string;
    submissionStatus?: string;
    gradingStatus?: string | null;
    quizScore?: number;
    score?: number;
  };
  questions: QuizQuestion[];
  canSeeCorrectAnswers?: boolean;
  settings?: {
    timeLimitMinutes: number;
    shuffleQuestions: boolean;
  };
}

// ─── Quiz Results (response từ getQuizResults) ────────────────────────────────

export interface QuizResultsResponse {
  canSeeScore?: boolean;
  canSeeCorrectAnswers?: boolean;
  message?: string;
  quizScore?: number;
  score?: number;
  gradingStatus?: string | null;
  quizAnswers?: QuizAnswer[];
  questions?: QuizQuestion[];
  passScore?: number;
  totalPoints?: number;
  submittedAt?: string;
  /** Chỉ có khi trưởng nhóm xem */
  submissions?: Submission[];
}
