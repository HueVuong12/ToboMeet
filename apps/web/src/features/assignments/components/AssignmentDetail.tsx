import React, { useEffect } from "react";
import { Assignment, Submission } from "../types";
import { ArrowLeft, Calendar, File, CheckCircle2, Clock, UserCheck, ShieldAlert } from "lucide-react";
import AssignmentSubmission from "./AssignmentSubmission";
import { socket } from "@/lib/socket";

interface AssignmentDetailProps {
  assignment: Assignment;
  submission: Submission | null;
  isTeacher: boolean;
  onBack: () => void;
  onSubmit: (attachments: any[]) => Promise<void>;
  isSubmitting: boolean;
  onGradeClick: () => void;
  refetchSubmission?: () => void;
}

export default function AssignmentDetail({
  assignment,
  submission,
  isTeacher,
  onBack,
  onSubmit,
  isSubmitting,
  onGradeClick,
  refetchSubmission,
}: AssignmentDetailProps) {
  const isPastDeadline = new Date() > new Date(assignment.deadline);

  // L?ng nghe socket event n?u giáo viên ch?m di?m d? t? d?ng c?p nh?t UI cho h?c viên
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleAssignmentGraded = (data: any) => {
      if (data.roomId === assignment.roomId && refetchSubmission) {
        refetchSubmission();
      }
    };

    socket.on("assignment_graded", handleAssignmentGraded);

    return () => {
      socket.off("assignment_graded", handleAssignmentGraded);
    };
  }, [assignment.roomId, refetchSubmission]);

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
          <h2 className="font-bold text-slate-800 text-sm">Chi ti?t bài t?p</h2>
        </div>

        {isTeacher && (
          <button
            onClick={onGradeClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <UserCheck size={14} />
            <span>Ch?m di?m</span>
          </button>
        )}
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
                {assignment.gradingType === "graded" ? `T?i da ${assignment.maxScore} di?m` : "Không ch?m di?m"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
              <Calendar size={13} />
              <span>Th?i h?n: {new Date(assignment.deadline).toLocaleString("vi-VN")}</span>
            </div>
          </div>

          {/* Description */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-bold text-slate-700 mb-2">Hu?ng d?n</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
              {assignment.description || "Không có hu?ng d?n"}
            </p>
          </div>

          {/* Attachments */}
          {assignment.attachments.length > 0 && (
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
              <h3 className="text-xs font-bold text-slate-700">T?p tài li?u dính kèm</h3>
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
        </div>

        {/* Right: Submission & Grading result */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          {/* H?c sinh n?p bài */}
          {!isTeacher && (
            <AssignmentSubmission
              assignment={assignment}
              submission={submission}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Hi?n th? di?m s? khi giáo viên dã ch?m di?m (Dành cho h?c sinh) */}
          {!isTeacher && submission && (submission.score !== undefined || submission.feedback) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2.5">
                K?t qu? ch?m di?m
              </h3>

              {submission.score !== undefined && (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-brand-600">{submission.score}</span>
                  <span className="text-slate-400 text-xs">/ {assignment.maxScore} di?m</span>
                </div>
              )}

              {submission.feedback && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nh?n xét c?a giáo viên
                  </span>
                  <p className="text-xs text-slate-600 italic whitespace-pre-wrap">{submission.feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
