import React, { useEffect, useState, useRef } from "react";
import { Assignment, Submission } from "./types";
import {
  ArrowLeft,
  Calendar,
  File,
  FileUp,
  CheckCircle2,
  Clock,
  UserCheck,
  Lock,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  Plus,
  Grid,
  List,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { uploadReportEvidence } from "@/services/uploadService";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { useTranslations } from "next-intl";

interface AssignmentDetailProps {
  assignment: Assignment;
  submission: Submission | null;
  isTeacher: boolean;
  roomMembers: any[];
  comments?: any[];
  userId?: string;
  onBack: () => void;
  onSubmit: (attachments: any[]) => Promise<void>;
  isSubmitting: boolean;
  onGradeClick: () => void;
  refetchSubmission?: () => void;
  onDeleteSubmission: () => Promise<void>;
  onDeleteAssignment?: () => Promise<void>;
  onAddComment: (assignmentId: string, content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
}

export default function AssignmentDetail({
  assignment,
  submission,
  isTeacher,
  roomMembers,
  comments = [],
  userId,
  onBack,
  onSubmit,
  isSubmitting,
  onGradeClick,
  refetchSubmission,
  onDeleteSubmission,
  onDeleteAssignment,
  onAddComment,
  onDeleteComment,
}: AssignmentDetailProps) {
  const t = useTranslations("room.assignments_i18n");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const handleConfirmDeleteComment = async () => {
    if (!commentToDelete || !onDeleteComment || isDeletingComment) return;
    try {
      setIsDeletingComment(true);
      await onDeleteComment(commentToDelete);
      setCommentToDelete(null);
    } catch (e) {
      console.error("Delete comment error:", e);
    } finally {
      setIsDeletingComment(false);
    }
  };

  // Form states
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync attachments with submission when it changes
  useEffect(() => {
    if (submission) {
      setAttachments(submission.attachments || []);
    } else {
      setAttachments([]);
    }
  }, [submission]);

  const assignmentId = String(assignment?._id || assignment?.id || "");
  const assignmentRoomId = assignment?.roomId;

  const refetchSubmissionRef = useRef(refetchSubmission);
  useEffect(() => {
    refetchSubmissionRef.current = refetchSubmission;
  }, [refetchSubmission]);

  // Realtime updates via socket for grading & submission deletion
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleAssignmentGraded = (data: any) => {
      if (data.roomId === assignmentRoomId && refetchSubmissionRef.current) {
        refetchSubmissionRef.current();
      }
    };

    const handleSubmissionDeleted = (data: any) => {
      const eventAssignId = String(data?.assignmentId || data?.submission?.assignmentId || "");
      if ((eventAssignId === assignmentId || data?.roomId === assignmentRoomId) && refetchSubmissionRef.current) {
        refetchSubmissionRef.current();
      }
    };

    socket.on("assignment_graded", handleAssignmentGraded);
    socket.on("assignment_submission_deleted", handleSubmissionDeleted);

    return () => {
      socket.off("assignment_graded", handleAssignmentGraded);
      socket.off("assignment_submission_deleted", handleSubmissionDeleted);
    };
  }, [assignmentId, assignmentRoomId]);

  // Date formatting helpers matching Moodle format (e.g. Sunday, 15 December 2024, 12:00 AM)
  const formatLMSDate = (dateStr: string | Date) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const weekdays = [
      t("detail.weekdays.0"),
      t("detail.weekdays.1"),
      t("detail.weekdays.2"),
      t("detail.weekdays.3"),
      t("detail.weekdays.4"),
      t("detail.weekdays.5"),
      t("detail.weekdays.6"),
    ];
    const months = [
      t("detail.months.0"),
      t("detail.months.1"),
      t("detail.months.2"),
      t("detail.months.3"),
      t("detail.months.4"),
      t("detail.months.5"),
      t("detail.months.6"),
      t("detail.months.7"),
      t("detail.months.8"),
      t("detail.months.9"),
      t("detail.months.10"),
      t("detail.months.11"),
    ];

    const weekday = weekdays[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    return `${weekday}, ${day} ${month} ${year}, ${timeStr}`;
  };

  const getRemainingOrOverdueText = (deadlineStr: string, submissionDateStr?: string) => {
    if (!deadlineStr) return "-";
    const deadline = new Date(deadlineStr);
    const target = submissionDateStr ? new Date(submissionDateStr) : new Date();

    const diffMs = deadline.getTime() - target.getTime();
    const isOverdue = diffMs < 0;
    const absDiff = Math.abs(diffMs);

    const totalSeconds = Math.floor(absDiff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    const years = Math.floor(totalDays / 365);
    const remainingDays = totalDays % 365;

    let timeText = "";
    if (years > 0) {
      timeText = t("detail.time_units.years_days", { years, days: remainingDays });
    } else if (totalDays > 0) {
      const remainingHours = totalHours % 24;
      timeText = t("detail.time_units.days_hours", { days: totalDays, hours: remainingHours });
    } else if (totalHours > 0) {
      const remainingMinutes = totalMinutes % 60;
      timeText = t("detail.time_units.hours_minutes", { hours: totalHours, minutes: remainingMinutes });
    } else if (totalMinutes > 0) {
      const remainingSeconds = totalSeconds % 60;
      timeText = t("detail.time_units.minutes_seconds", { minutes: totalMinutes, seconds: remainingSeconds });
    } else {
      timeText = t("detail.time_units.seconds", { seconds: totalSeconds });
    }

    if (submissionDateStr) {
      if (isOverdue) {
        return <span className="text-red-600 font-medium">{t("detail.remaining_overdue.submitted_late", { time: timeText })}</span>;
      } else {
        return <span className="text-brand-600 font-medium">{t("detail.remaining_overdue.submitted_early", { time: timeText })}</span>;
      }
    } else {
      if (isOverdue) {
        return <span className="text-red-600 font-bold">{t("detail.remaining_overdue.late", { time: timeText })}</span>;
      } else {
        return <span className="text-slate-700 font-medium">{t("detail.remaining_overdue.left", { time: timeText })}</span>;
      }
    }
  };

  const getFileIconAndStyle = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return { style: "bg-red-50 text-red-600 border-red-100", label: "PDF" };
      case "zip":
      case "rar":
      case "7z":
        return { style: "bg-purple-50 text-purple-600 border-purple-100", label: "ZIP" };
      case "doc":
      case "docx":
        return { style: "bg-blue-50 text-blue-600 border-blue-100", label: "Word" };
      case "xls":
      case "xlsx":
        return { style: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Excel" };
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
        return { style: "bg-amber-50 text-amber-600 border-amber-100", label: "Image" };
      default:
        return { style: "bg-slate-50 text-slate-600 border-slate-100", label: "File" };
    }
  };

  const formatScoreDisplay = (score?: number, maxScore?: number) => {
    const formattedScore = (score ?? 0).toLocaleString("vi-VN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedMax = (maxScore ?? 100).toLocaleString("vi-VN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formattedScore} / ${formattedMax}`;
  };

  // Upload handler for files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 20) {
      toast.error(t("detail.toast_file_limit"));
      return;
    }

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t("detail.toast_file_size", { name: file.name }));
          continue;
        }

        const uploaded = await uploadReportEvidence(file);
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: uploaded.url,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t("detail.toast_upload_fail"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 20) {
      toast.error(t("detail.toast_file_limit"));
      return;
    }

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t("detail.toast_file_size", { name: file.name }));
          continue;
        }

        const uploaded = await uploadReportEvidence(file);
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: uploaded.url,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || t("detail.toast_upload_fail"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveSubmission = async () => {
    if (attachments.length === 0) {
      toast.error(t("detail.toast_min_one_file"));
      return;
    }
    await onSubmit(attachments);
    setIsFormOpen(false);
  };

  const handleAddCommentSubmit = async () => {
    if (!commentInput.trim() || !assignment) return;
    await onAddComment(assignment._id, commentInput.trim());
    setCommentInput("");
  };

  const resolveMemberName = (userId: string) => {
    const member = roomMembers.find((m) => m.userId === userId || m.supabaseId === userId);
    return member?.displayName || t("detail.member_fallback");
  };

  const getRoleLabel = (role: string) => {
    const r = role?.toLowerCase();
    if (r === "owner" || r === "admin") {
      return t("detail.roles.leader");
    }
    return null;
  };

  const isOverdue = assignment.deadline ? new Date() > new Date(assignment.deadline) : false;
  // Nhiệm vụ bị khóa nộp: hết hạn VÀ chính sách là khóa sau deadline
  const isLocked = isOverdue && assignment.submissionPolicy === "lock_after_deadline";

  // 1. TRƯỞNG NHÓM VIEW (GIỮ NGUYÊN KHÔNG ĐƯỢC CHỈNH SỬA)
  if (isTeacher) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="font-bold text-slate-800 text-sm">{t("detail.title")}</span>
          </div>
          <button
            onClick={onGradeClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
          >
            {t("detail.grade_btn")}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6">
          {/* Left: Detail Info */}
          <div className="flex-1 flex flex-col gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  {assignment.title}
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                    assignment.gradingType === "graded"
                      ? "bg-purple-50 text-purple-600 border border-purple-100"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {assignment.gradingType === "graded" ? t("detail.graded_score", { score: assignment.maxScore ?? 0 }) : t("detail.ungraded")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                <Calendar size={13} />
                <span>{t("detail.deadline_label", { date: formatLMSDate(assignment.deadline) })}</span>
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-700 mb-2">{t("detail.instructions")}</h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {assignment.description || t("detail.no_instructions")}
              </p>
            </div>

            {/* Attachments */}
            {assignment.attachments.length > 0 && (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-700">{t("detail.attachments_label")}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {assignment.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 hover:border-brand-500 rounded-xl text-xs hover:underline hover:text-brand-600 transition-colors"
                    >
                      <File size={15} className="text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700 truncate">{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comments for Teacher */}
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
              <button
                onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                className="flex items-center gap-1 text-xs text-slate-700 hover:text-slate-800 font-semibold"
              >
                {isCommentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{t("detail.comments_count", { count: comments.length })}</span>
              </button>

              {isCommentsExpanded && (
                <div className="flex flex-col gap-3 mt-2 border-t border-slate-100 pt-3">
                  {comments.length > 0 ? (
                    <div className="flex flex-col gap-2.5 max-h-52 overflow-y-auto">
                      {comments.map((comment, index) => (
                        <div key={index} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex flex-col gap-0.5">
                          {/* Row 1: TÊN (trái) và BUTTON XÓA (phải) */}
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              {resolveMemberName(comment.userId)}
                              {getRoleLabel(comment.role) && (
                                <span className="text-[9px] bg-brand-50 text-brand-700 border border-brand-100 px-1 py-0.2 rounded font-semibold uppercase">
                                  {getRoleLabel(comment.role)}
                                </span>
                              )}
                            </span>
                            {comment.userId === userId && onDeleteComment && (
                              <button
                                type="button"
                                onClick={() => setCommentToDelete(comment._id)}
                                className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                                title={t("detail.delete_comment_btn")}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>

                          {/* Row 2: THỜI GIAN */}
                          <span className="text-[10px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleString("vi-VN")}
                          </span>

                          {/* Row 3: NỘI DUNG */}
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">{t("detail.no_comments")}</span>
                  )}

                  {/* Add comment box */}
                  <div className="flex gap-2 items-end">
                    <textarea
                      rows={2}
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={t("detail.write_reply")}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none resize-none"
                    />
                    <button
                      onClick={handleAddCommentSubmit}
                      disabled={!commentInput.trim()}
                      className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors"
                    >
                      {t("detail.send")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. THÀNH VIÊN VIEW (XÂY DỰNG GIAO DIỆN KIỂU LMS HOÀN CHỈNH)
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden relative">
      {/* Header */}
      <div className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-bold text-slate-800 text-sm">{t("detail.title")}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 flex flex-col gap-6 max-w-none w-full px-8">
        {/* Title */}
        <h1 className="text-xl font-bold text-slate-900 leading-tight">
          {assignment.title}
        </h1>

        {/* Opened & Due time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">{t("detail.opened")}:</span>{" "}
            {formatLMSDate(assignment.createdAt)}
          </div>
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">{t("detail.due")}:</span>{" "}
            {formatLMSDate(assignment.deadline)}
          </div>
        </div>

        {/* Instructions and Teacher Attachments */}
        {(assignment.description || (assignment.attachments && assignment.attachments.length > 0)) && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            {assignment.description && (
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {assignment.description}
              </div>
            )}

            {assignment.attachments && assignment.attachments.length > 0 && (
              <div className={`flex flex-col gap-2 ${assignment.description ? 'border-t border-slate-100 pt-4' : ''}`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {assignment.attachments.map((file, idx) => {
                    const fileMeta = getFileIconAndStyle(file.name);
                    return (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 hover:border-brand-500 rounded-xl text-xs transition-colors hover:underline hover:text-brand-600"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <File size={16} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700 truncate">{file.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${fileMeta.style}`}>
                          {fileMeta.label}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}



        {/* Action Button for Member */}
        <div className="flex gap-3 flex-wrap">
          {isLocked ? (
            /* Nhiệm vụ đã khóa — không cho nộp/sửa bài mới */
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold">
              <Lock size={14} />
              <span>Đã hết hạn nộp bài — Nhiệm vụ đã bị khóa</span>
            </div>
          ) : !submission ? (
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>{t("detail.add_submission")}</span>
            </button>
          ) : (
            <>
              {/* Chỉ cho sửa/xóa khi chưa bị khóa */}
              <button
                onClick={() => setIsFormOpen(true)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200"
              >
                {t("detail.edit_submission")}
              </button>
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200"
              >
                {t("detail.remove_submission")}
              </button>
            </>
          )}
        </div>

        {/* Accordion File picker Form (Popup Modal) */}
        {isFormOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col w-full max-w-2xl transform transition-all duration-300">
              <button
                onClick={() => setIsFormOpen(false)}
                className="flex justify-between items-center px-6 py-4 border-b border-slate-100 font-bold text-base text-slate-800 hover:bg-slate-50/50 shrink-0"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown size={20} />
                  <span>{t("detail.add_submission")}</span>
                </div>
              </button>

              <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>{t("detail.submitted_files")}</span>
                  <span>{t("detail.max_size_hint")}</span>
                </div>

                {/* Toolbar */}
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-t-xl p-2 text-slate-500 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      title="Thêm file"
                    >
                      <Plus size={16} />
                    </button>
                    <button className="p-1 hover:bg-slate-200 rounded text-slate-600 opacity-55 cursor-not-allowed">
                      <FolderPlus size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1 rounded ${viewMode === "grid" ? "bg-white text-slate-800 shadow-xs" : "hover:bg-slate-200"}`}
                    >
                      <Grid size={14} />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1 rounded ${viewMode === "list" ? "bg-white text-slate-800 shadow-xs" : "hover:bg-slate-200"}`}
                    >
                      <List size={14} />
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,image/*"
                  className="hidden"
                />

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-x border-b border-slate-200 p-8 flex flex-col items-center justify-center gap-3 bg-slate-50/20 text-slate-400 min-h-[160px] rounded-b-xl hover:border-brand-500 hover:bg-slate-50/40 transition-all relative"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={32} className="animate-spin text-brand-600" />
                      <span className="text-xs text-slate-500 font-medium">{t("detail.uploading_hint")}</span>
                    </>
                  ) : attachments.length === 0 ? (
                    <>
                      <FileUp size={36} className="opacity-40" />
                      <span className="text-xs text-slate-500 font-medium">{t("detail.drop_zone_hint")}</span>
                    </>
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-3 gap-3 w-full">
                      {attachments.map((file, idx) => {
                        const meta = getFileIconAndStyle(file.name);
                        return (
                          <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col items-center gap-2 relative">
                            <button
                              onClick={() => handleRemoveAttachment(idx)}
                              className="absolute top-1.5 right-1.5 p-1 bg-red-50 text-red-500 rounded-full hover:bg-red-100"
                            >
                              <X size={12} />
                            </button>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.style}`}>
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-slate-700 truncate w-full text-center">{file.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 w-full">
                      {attachments.map((file, idx) => {
                        const meta = getFileIconAndStyle(file.name);
                        return (
                          <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 p-2.5 rounded-xl text-xs w-full">
                            <div className="flex items-center gap-2 truncate">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${meta.style}`}>
                                {meta.label}
                              </span>
                              <span className="font-medium text-slate-700 truncate">{file.name}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveAttachment(idx)}
                              className="p-1 hover:bg-red-50 text-red-500 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400">
                  {t("detail.accepted_types")}
                </div>

                {/* Form actions */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-all"
                  >
                    {t("detail.cancel")}
                  </button>
                  <button
                    onClick={handleSaveSubmission}
                    disabled={isSubmitting || isUploading}
                    className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                  >
                    {t("detail.save_changes")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trạng thái bài nộp Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">{t("detail.submit_status")}</h3>
          </div>

          <table className="w-full text-xs text-left border-collapse">
            <tbody>
              {/* Trạng thái bài nộp */}
              <tr className="border-b border-slate-100">
                <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100">
                  {t("detail.submit_status")}
                </td>
                <td className="p-4">
                  {submission ? (
                    <span className="inline-block px-3 py-1 bg-brand-50 text-brand-700 border border-brand-100 font-semibold rounded-md">
                      {t("detail.submit_status_submitted")}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-medium">{t("detail.submit_status_not_submitted")}</span>
                  )}
                </td>
              </tr>

              {/* Trạng thái chấm điểm */}
              <tr className="border-b border-slate-100">
                <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100">
                  {t("detail.grade_status")}
                </td>
                <td className="p-4">
                  {submission?.score !== undefined ? (
                    <span className="inline-block px-3 py-1 bg-purple-50 text-purple-700 border border-purple-100 font-semibold rounded-md">
                      {t("detail.grade_status_graded", { score: submission.score ?? 0, maxScore: assignment.maxScore ?? 0 })}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-semibold">{t("detail.grade_status_not_graded")}</span>
                  )}
                </td>
              </tr>

              {/* Thời gian còn lại */}
              <tr className="border-b border-slate-100">
                <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100">
                  {t("detail.time_remaining")}
                </td>
                <td className="p-4">
                  {submission
                    ? getRemainingOrOverdueText(assignment.deadline, submission.submittedAt)
                    : getRemainingOrOverdueText(assignment.deadline)}
                </td>
              </tr>

              {/* Chỉnh sửa lần cuối */}
              {submission && (
                <tr className="border-b border-slate-100">
                  <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100">
                    {t("detail.last_modified")}
                  </td>
                  <td className="p-4 text-slate-600">
                    {formatLMSDate(submission.updatedAt || submission.submittedAt)}
                  </td>
                </tr>
              )}

              {/* Nộp tập tin */}
              {submission && submission.attachments.length > 0 && (
                <tr className="border-b border-slate-100">
                  <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100">
                    {t("detail.submitted_files")}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2.5">
                      {submission.attachments.map((file, idx) => {
                        const meta = getFileIconAndStyle(file.name);
                        return (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 hover:underline hover:text-brand-600 transition-colors"
                          >
                            <File size={16} className="text-slate-400 shrink-0" />
                            <span className="text-slate-700 font-medium truncate max-w-[240px]">{file.name}</span>
                            {file.uploadedAt && (
                              <span className="text-[10px] text-slate-400">
                                ({new Date(file.uploadedAt).toLocaleString("vi-VN")})
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}

              {/* Bình luận */}
              <tr>
                <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100 rounded-bl-2xl">
                  {t("detail.comments_label")}
                </td>
                <td className="p-4 rounded-br-2xl">
                  <div className="flex flex-col gap-3 pb-3">
                    <button
                      onClick={() => setIsCommentsExpanded(!isCommentsExpanded)}
                      className="flex items-center gap-1 text-xs text-slate-700 hover:text-slate-800 font-semibold"
                    >
                      {isCommentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{t("detail.comments_count", { count: comments.length })}</span>
                    </button>

                    {isCommentsExpanded && (
                      <div className="flex flex-col gap-3 mt-2 border-t border-slate-100 pt-3">
                        {comments.length > 0 ? (
                          <div className="flex flex-col gap-2.5 max-h-52 overflow-y-auto">
                            {comments.map((comment, index) => (
                              <div key={index} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex flex-col gap-0.5">
                                {/* Row 1: TÊN (trái) và BUTTON XÓA (phải) */}
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                    {resolveMemberName(comment.userId)}
                                    {getRoleLabel(comment.role) && (
                                      <span className="text-[9px] bg-brand-50 text-brand-700 border border-brand-100 px-1 py-0.2 rounded font-semibold uppercase">
                                        {getRoleLabel(comment.role)}
                                      </span>
                                    )}
                                  </span>
                                  {comment.userId === userId && onDeleteComment && (
                                    <button
                                      type="button"
                                      onClick={() => setCommentToDelete(comment._id)}
                                      className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                                      title={t("detail.delete_comment_btn")}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>

                                {/* Row 2: THỜI GIAN */}
                                <span className="text-[10px] text-slate-400">
                                  {new Date(comment.createdAt).toLocaleString("vi-VN")}
                                </span>

                                {/* Row 3: NỘI DUNG */}
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{comment.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">{t("detail.no_comments")}</span>
                        )}

                        {/* Add comment box */}
                        <div className="flex gap-2 items-end">
                          <textarea
                            rows={2}
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            placeholder={t("detail.write_reply")}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none resize-none"
                          />
                          <button
                            onClick={handleAddCommentSubmit}
                            disabled={!commentInput.trim()}
                            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors"
                          >
                            {t("detail.send")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Khối Nhận xét (Feedback) */}
        {submission && (submission.score !== undefined || submission.gradedAt) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">{t("detail.feedback_title")}</h3>
            </div>

            <table className="w-full text-xs text-left border-collapse">
              <tbody>
                {/* Dòng 1: Đánh giá */}
                <tr className="border-b border-slate-100">
                  <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100">
                    {t("detail.grade_label")}
                  </td>
                  <td className="p-4 text-slate-700 font-medium">
                    {formatScoreDisplay(submission.score, assignment.maxScore)}
                  </td>
                </tr>

                {/* Dòng 2: Đánh giá cho */}
                <tr className={submission.feedback ? "border-b border-slate-100" : ""}>
                  <td className={`w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100 ${!submission.feedback ? "rounded-bl-2xl" : ""}`}>
                    {t("detail.graded_on_label")}
                  </td>
                  <td className={`p-4 text-slate-700 ${!submission.feedback ? "rounded-br-2xl" : ""}`}>
                    {formatLMSDate(submission.gradedAt || submission.updatedAt)}
                  </td>
                </tr>

                {/* Dòng 3: Lời nhận xét (nếu có) */}
                {submission.feedback && (
                  <tr>
                    <td className="w-1/3 p-4 bg-slate-50/50 font-bold text-slate-700 border-r border-slate-100 rounded-bl-2xl">
                      {t("detail.feedback_comments_label")}
                    </td>
                    <td className="p-4 text-slate-700 whitespace-pre-wrap rounded-br-2xl">
                      {submission.feedback}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4 flex flex-col transform transition-all duration-300">
            <h3 className="text-base font-bold text-slate-900 mb-2">{t("detail.delete_confirm_title")}</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {t("detail.delete_confirm_desc")}
            </p>
            <div className="flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                {t("detail.cancel")}
              </button>
              <button
                onClick={async () => {
                  if (onDeleteAssignment && isTeacher) {
                    await onDeleteAssignment();
                  } else {
                    await onDeleteSubmission();
                  }
                  setShowConfirmDelete(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#d9534f] hover:bg-[#c9302c] rounded-lg transition-colors shadow-sm"
              >
                {t("detail.delete_confirm_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Comment Confirmation Popup */}
      {commentToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mx-4 flex flex-col transform transition-all duration-300">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {t("detail.confirm_delete_comment_title")}
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {t("detail.confirm_delete_comment_msg")}
            </p>
            <div className="flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setCommentToDelete(null)}
                disabled={isDeletingComment}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                {t("detail.cancel_btn")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteComment}
                disabled={isDeletingComment}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
              >
                {isDeletingComment && <Loader2 size={13} className="animate-spin" />}
                {t("detail.delete_comment_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
