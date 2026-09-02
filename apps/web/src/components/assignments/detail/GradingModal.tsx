import React, { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  File,
  Save,
  Loader2,
  ExternalLink,
  Download,
  AlertCircle,
  FileText,
  Clock,
} from "lucide-react";
import { Assignment, Submission } from "../types";
import { MemberWithSubmission } from "./SubmissionMembersTable";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { downloadFileDirectly } from "../utils/downloadHelper";

interface GradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
  members: MemberWithSubmission[];
  currentMemberIndex: number;
  onNavigateMember: (newIndex: number) => void;
  onGrade: (
    memberUserId: string,
    submissionId: string | undefined,
    score: number | undefined,
    feedback: string
  ) => Promise<void>;
  isGrading: boolean;
}

export default function GradingModal({
  isOpen,
  onClose,
  assignment,
  members,
  currentMemberIndex,
  onNavigateMember,
  onGrade,
  isGrading,
}: GradingModalProps) {
  const t = useTranslations("room.assignments_i18n.lms");
  const currentMember = members[currentMemberIndex];
  const submission = currentMember?.submission;

  const [scoreInput, setScoreInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleDownloadFile = async (url: string, fileName: string) => {
    if (downloadingFile) return;
    setDownloadingFile(fileName);
    try {
      await downloadFileDirectly(url, fileName);
    } finally {
      setDownloadingFile(null);
    }
  };

  useEffect(() => {
    if (submission) {
      setScoreInput(submission.score !== undefined ? String(submission.score) : "");
      setFeedbackInput(submission.feedback || "");
      setActiveFileIndex(0);
    } else {
      setScoreInput("");
      setFeedbackInput("");
      setActiveFileIndex(0);
    }
  }, [submission, currentMemberIndex]);

  if (!isOpen || !currentMember) return null;

  const maxScore = assignment.gradingType === "graded" ? (assignment.maxScore ?? 10) : 10;
  const attachments = submission?.attachments || [];
  const activeFile = attachments[activeFileIndex] || null;

  const handlePrev = () => {
    if (currentMemberIndex > 0) {
      onNavigateMember(currentMemberIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentMemberIndex < members.length - 1) {
      onNavigateMember(currentMemberIndex + 1);
    }
  };

  const parsedScore = scoreInput.trim() !== "" ? Number(scoreInput) : NaN;
  const isScoreValid =
    assignment.gradingType === "graded"
      ? !isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= maxScore
      : true;

  const isSaveDisabled = isGrading || !isScoreValid;

  const handleSaveGrade = async () => {
    if (!currentMember) return;

    let score: number | undefined = undefined;
    if (assignment.gradingType === "graded") {
      if (scoreInput.trim() === "") {
        toast.error(t("score_placeholder"));
        return;
      }
      score = Number(scoreInput);
      if (isNaN(score) || score < 0 || score > maxScore) {
        toast.error(t("toast_score_exceed", { maxScore }));
        return;
      }
    }

    try {
      await onGrade(currentMember.userId, submission?._id, score, feedbackInput.trim());
      toast.success(t("toast_save_success"));
      // Tự động chuyển sang học viên tiếp theo nếu có
      if (currentMemberIndex < members.length - 1) {
        onNavigateMember(currentMemberIndex + 1);
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Error");
    }
  };

  const isImageFile = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext || "");
  };

  const isPdfFile = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.split(".").pop()?.toLowerCase();
    return ext === "pdf";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-slate-200 text-slate-900 px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold text-sm truncate text-slate-900">
            {activeFile?.name || currentMember.displayName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Navigation < > between members */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg text-slate-700">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentMemberIndex === 0}
              className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition-colors cursor-pointer"
              title={t("prev_student")}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-semibold px-1 text-slate-700">
              {currentMemberIndex + 1} / {members.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentMemberIndex === members.length - 1}
              className="p-1 hover:bg-slate-200 disabled:opacity-30 rounded text-slate-600 transition-colors cursor-pointer"
              title={t("next_student")}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {t("close")}
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#F4F5F7] overflow-hidden">
        {/* Left View: File Viewer (65%) */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#E8EAEE] p-4 items-center justify-center overflow-auto relative">
          {attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <AlertCircle size={48} className="mb-3 opacity-40 text-slate-500" />
              <p className="text-sm font-bold text-slate-600">{t("empty_files_title")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("empty_files_desc")}</p>
            </div>
          ) : activeFile ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {isImageFile(activeFile.name) ? (
                <div className="max-w-full max-h-full flex items-center justify-center p-2">
                  <img
                    src={activeFile.url}
                    alt={activeFile.name}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-md bg-white"
                  />
                </div>
              ) : isPdfFile(activeFile.name) ? (
                <iframe
                  src={activeFile.url}
                  title={activeFile.name}
                  className="w-full h-full rounded-lg border border-slate-300 bg-white"
                />
              ) : (
                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                    <File size={32} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1 truncate max-w-full">
                    {activeFile.name}
                  </h4>
                  <p className="text-xs text-slate-400 mb-6">
                    Định dạng tệp tin này xem tốt nhất khi tải về hoặc mở ở tab mới
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(activeFile.url, activeFile.name)}
                      disabled={downloadingFile === activeFile.name}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {downloadingFile === activeFile.name ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      <span>Tải xuống</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right Side: Grading & Feedback Panel (35% - width 380px) */}
        <div className="w-full md:w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full overflow-y-auto">
          {/* Student info header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-end mb-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentMemberIndex === 0}
                  className="p-1 hover:bg-slate-100 disabled:opacity-20 rounded text-slate-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentMemberIndex === members.length - 1}
                  className="p-1 hover:bg-slate-100 disabled:opacity-20 rounded text-slate-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <h3 className="font-bold text-slate-900 text-base">
              {currentMember.displayName}
            </h3>

            {submission?.submittedAt ? (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Clock size={12} />
                <span>
                  {t("submitted_at", { date: new Date(submission.submittedAt).toLocaleString() })}
                </span>
              </p>
            ) : (
              <p className="text-xs text-amber-600 font-medium mt-1">{t("status_not_submitted")}</p>
            )}
          </div>

          {/* Attached files list */}
          <div className="p-5 border-b border-slate-100 space-y-2">
            <span className="text-xs font-bold text-slate-700 block mb-2">
              {t("submitted_files_title", { count: attachments.length })}
            </span>
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{t("no_submitted_files")}</p>
            ) : (
              attachments.map((file, idx) => {
                const isDownloadingThis = downloadingFile === file.name;
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveFileIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      activeFileIndex === idx
                        ? "bg-brand-50 border-brand-300 ring-1 ring-brand-300 text-brand-700"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                      <FileText size={16} className="shrink-0 text-slate-400" />
                      <span className="text-xs font-medium truncate select-none">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadFile(file.url, file.name);
                      }}
                      disabled={isDownloadingThis}
                      className="p-1.5 hover:bg-black/10 active:bg-black/20 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      title="Tải xuống"
                    >
                      {isDownloadingThis ? (
                        <Loader2 size={15} className="text-brand-600 animate-spin" />
                      ) : (
                        <Download size={15} />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Feedback section */}
          <div className="p-5 border-b border-slate-100 flex-1 flex flex-col">
            <label className="text-xs font-bold text-slate-800 block mb-2">
              {t("feedback_title")}
            </label>
            <textarea
              rows={4}
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              placeholder={t("feedback_placeholder")}
              className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl text-xs text-slate-800 focus:outline-none resize-none flex-1 transition-all"
            />
          </div>

          {/* Score section & Action buttons */}
          <div className="p-5 bg-slate-50 space-y-4">
            {assignment.gradingType === "graded" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">{t("grade_title")}</label>
                  <span className="text-xs font-medium text-slate-400">
                    {t("on_scale", { maxScore })}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={maxScore}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder={t("score_placeholder")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-brand-500 rounded-xl text-sm font-bold text-slate-800 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    / {maxScore}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveGrade}
              disabled={isSaveDisabled}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGrading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{submission?.score !== undefined ? t("update_grade_btn") : t("save_grade_btn")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
