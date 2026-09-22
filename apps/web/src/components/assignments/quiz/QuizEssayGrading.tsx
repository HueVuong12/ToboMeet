import React, { useState, useEffect } from "react";
import { ArrowLeft, Check, Award, AlertCircle, User, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import {
  useGetQuizResultsQuery,
  useGradeEssayQuestionMutation,
} from "@/lib/redux/api/assignmentsApi";
import { Assignment, Submission, QuizQuestion } from "../types";

interface QuizEssayGradingProps {
  assignment: Assignment;
  roomMembers?: { userId?: string; name?: string; displayName?: string }[];
  onBack: () => void;
}

export default function QuizEssayGrading({
  assignment,
  roomMembers = [],
  onBack,
}: QuizEssayGradingProps) {
  const t = useTranslations("room.assignments_i18n");
  const { data, isLoading, refetch } = useGetQuizResultsQuery(assignment._id);
  const [gradeEssay, { isLoading: isGrading }] = useGradeEssayQuestionMutation();

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const handleAssignmentSubmitted = (data: any) => {
      const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
      if (eventAssignId === String(assignment._id)) {
        refetch();
      }
    };

    const handleAssignmentGraded = (data: any) => {
      const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
      if (eventAssignId === String(assignment._id)) {
        refetch();
      }
    };

    const handleAssignmentUpdated = (data: any) => {
      const eventAssignId = String(data.assignmentId || data.assignment?._id || data._id || "");
      if (eventAssignId === String(assignment._id)) {
        refetch();
      }
    };

    const handleAssignmentDeleted = (data: any) => {
      const deletedId = String(data.assignmentId || data._id || "");
      if (deletedId === String(assignment._id)) {
        toast.error(t("toast_deleted_by_system"));
        onBack();
      }
    };

    socket.on("assignment_submitted", handleAssignmentSubmitted);
    socket.on("assignment_graded", handleAssignmentGraded);
    socket.on("assignment_updated", handleAssignmentUpdated);
    socket.on("assignment_deleted", handleAssignmentDeleted);

    return () => {
      socket.off("assignment_submitted", handleAssignmentSubmitted);
      socket.off("assignment_graded", handleAssignmentGraded);
      socket.off("assignment_updated", handleAssignmentUpdated);
      socket.off("assignment_deleted", handleAssignmentDeleted);
    };
  }, [assignment._id, assignment.title, roomMembers, refetch, t, onBack]);

  const essayQuestions: QuizQuestion[] = (data?.questions || []).filter(
    (q: QuizQuestion) => q.questionType === "text"
  );
  const submissions: Submission[] = data?.submissions || [];

  const handleScoreChange = (qId: string, value: number, maxPoints: number) => {
    const clamped = Math.max(0, Math.min(maxPoints, value));
    setScores((prev) => ({ ...prev, [qId]: clamped }));
  };

  const handleSaveGrade = async (studentId: string) => {
    const essayScores = essayQuestions.map((q) => ({
      questionId: q._id,
      score: scores[q._id] ?? 0,
    }));

    try {
      await gradeEssay({
        assignmentId: assignment._id,
        studentId,
        essayScores,
      }).unwrap();
      toast.success(t("quiz_grade_save_success"));
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("quiz_grade_save_error"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-[#0052FF] animate-spin" />
      </div>
    );
  }

  if (essayQuestions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-base font-bold text-slate-800">{t("quiz_grade_no_essay_title")}</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {t("quiz_grade_no_essay_desc")}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {t("quiz_back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-900">{t("quiz_grade_header_title")}</h1>
            <p className="text-[11px] text-slate-500">
              {t("quiz_grade_submissions_count", { title: assignment.title, count: submissions.length })}
            </p>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left column: Student list */}
        <div className="w-full md:w-80 border-r border-slate-200 bg-white overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">
            {t("quiz_grade_submissions_list", { count: submissions.length })}
          </h2>
          {submissions.length === 0 ? (
            <p className="text-xs text-slate-400 p-2">{t("quiz_grade_no_submissions")}</p>
          ) : (
            submissions.map((sub) => {
              const member = roomMembers.find((m) => m.userId === sub.studentId);
              const name = member?.displayName || member?.name || `${t("quiz_grade_student_default")} (${sub.studentId.substring(0, 6)})`;
              const isSelected = (selectedStudentId || submissions[0]?.studentId) === sub.studentId;
              const isPending = sub.gradingStatus === "pending_manual";

              return (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => {
                    setSelectedStudentId(sub.studentId);
                    // Pre-fill existing scores if any
                    const initScores: Record<string, number> = {};
                    (sub.quizAnswers || []).forEach((ans) => {
                      // default 0
                      initScores[ans.questionId] = 0;
                    });
                    setScores(initScores);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-blue-50/80 border-[#0052FF] text-[#0052FF]"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 font-bold text-xs">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-slate-800">{name}</p>
                      <p className="text-[10px] text-slate-400">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : ""}
                      </p>
                    </div>
                  </div>

                  {isPending ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      {t("quiz_grade_status_pending")}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {sub.score ?? sub.quizScore ?? 0}đ
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Right column: Answers to grade */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {(() => {
            const activeSub = submissions.find(
              (s) => s.studentId === (selectedStudentId || submissions[0]?.studentId)
            );

            if (!activeSub) {
              return (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  {t("quiz_grade_select_student_hint")}
                </div>
              );
            }

            const member = roomMembers.find((m) => m.userId === activeSub.studentId);
            const name = member?.displayName || member?.name || t("quiz_grade_student_default");

            return (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{name}</h2>
                    <p className="text-xs text-slate-500">
                      {t("quiz_grade_temp_score", { score: activeSub.quizScore ?? activeSub.score ?? 0 })}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isGrading}
                    onClick={() => handleSaveGrade(activeSub.studentId)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0052FF] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{t("quiz_grade_save_btn")}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {essayQuestions.map((q, idx) => {
                    const ans = (activeSub.quizAnswers || []).find((a) => a.questionId === q._id);
                    const currentScore = scores[q._id] ?? 0;

                    return (
                      <div
                        key={q._id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <span className="text-xs font-bold text-[#0052FF]">
                            {t("quiz_grade_max_points", { number: idx + 1, points: q.points })}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {t("quiz_grade_assign_score")}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={q.points}
                              value={currentScore}
                              onChange={(e) =>
                                handleScoreChange(q._id, parseInt(e.target.value) || 0, q.points)
                              }
                              className="w-16 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-xs text-slate-400">/ {q.points}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-800 mb-2">{q.title}</p>
                          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {ans?.textAnswer ? (
                              ans.textAnswer
                            ) : (
                              <span className="italic text-slate-400">
                                {t("quiz_grade_no_text_answer")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
