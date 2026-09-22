import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Grid,
  AlertCircle,
  HelpCircle,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import { useGetQuizResultsQuery } from "@/lib/redux/api/assignmentsApi";
import { Assignment, QuizQuestion, QuizAnswer } from "../types";
import QuizNavigator from "./QuizNavigator";

interface QuizResultProps {
  assignment: Assignment;
  userId: string;
  onBack: () => void;
}

export default function QuizResult({
  assignment,
  userId,
  onBack,
}: QuizResultProps) {
  const t = useTranslations("room.assignments_i18n");
  const { data, isLoading, error, refetch } = useGetQuizResultsQuery(assignment._id);
  const [showNavigator, setShowNavigator] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const handleAssignmentGraded = (data: any) => {
      const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
      if (eventAssignId === String(assignment._id)) {
        refetch();
        const targetStudentId = String(data.studentId || data.submission?.studentId || "");
        if (targetStudentId === String(userId)) {
          toast.success(t("toast_quiz_graded_student", { title: assignment.title }));
        }
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

    socket.on("assignment_graded", handleAssignmentGraded);
    socket.on("assignment_updated", handleAssignmentUpdated);
    socket.on("assignment_deleted", handleAssignmentDeleted);

    return () => {
      socket.off("assignment_graded", handleAssignmentGraded);
      socket.off("assignment_updated", handleAssignmentUpdated);
      socket.off("assignment_deleted", handleAssignmentDeleted);
    };
  }, [assignment._id, assignment.title, userId, refetch, t, onBack]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
        <Loader2 className="w-8 h-8 text-[#0052FF] animate-spin" />
        <p className="text-xs font-semibold text-slate-500 mt-3">{t("quiz_result_loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-base font-bold text-slate-800">{t("quiz_result_error_title")}</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {data?.message || t("quiz_result_not_ready")}
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

  const score = data.score ?? data.quizScore ?? 0;
  const totalPoints = data.totalPoints ?? assignment.maxScore ?? 0;
  const passScore = data.passScore ?? assignment.quizSettings?.passScore ?? 0;
  const isPassed = totalPoints > 0 ? score >= passScore : true;
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const isPending = data.gradingStatus === "pending_manual";

  const questions: QuizQuestion[] = data.questions || [];
  const answers: QuizAnswer[] = data.quizAnswers || [];
  const answersMap = new Map(answers.map((a) => [a.questionId, a]));

  // Build correct map for navigator
  const correctMap = new Map<string, boolean | null>();
  if (data.canSeeCorrectAnswers) {
    questions.forEach((q) => {
      if (q.questionType === "text") {
        correctMap.set(q._id, null); // essay
      } else {
        const studentAns = answersMap.get(q._id);
        const correctOptIds = q.options.filter((o) => o.isCorrect).map((o) => o._id);
        const selectedOptIds = studentAns?.selectedOptionIds || [];

        const isAllCorrect =
          correctOptIds.length > 0 &&
          correctOptIds.every((id) => selectedOptIds.includes(id)) &&
          selectedOptIds.every((id) => correctOptIds.includes(id));

        correctMap.set(q._id, isAllCorrect);
      }
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {t("quiz_result_header_title", { title: assignment.title })}
            </h1>
            <p className="text-[11px] text-slate-500">
              {isPending
                ? t("quiz_result_header_pending")
                : (() => {
                    try {
                      return t("quiz_result_header_score", { score, total: totalPoints, percentage });
                    } catch {
                      return `${score} / ${totalPoints} (${percentage}%)`;
                    }
                  })()}
            </p>
          </div>
        </div>

        {/* Right side: Navigator button */}
        {data.canSeeCorrectAnswers && (
          <button
            type="button"
            onClick={() => setShowNavigator(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
            title={t("quiz_result_grid_tooltip")}
          >
            <Grid className="w-3.5 h-3.5 text-[#0052FF]" />
            <span>{t("quiz_result_grid_btn", { count: questions.length })}</span>
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-5">
        {/* Score Banner */}
        <div
          className={`rounded-2xl border p-5 text-center shadow-2xs ${
            isPending
              ? "bg-amber-50/70 border-amber-200"
              : isPassed
              ? "bg-emerald-50/70 border-emerald-200"
              : "bg-blue-50/70 border-blue-200"
          }`}
        >
          {isPending && (
            <div className="flex justify-center mb-2.5">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
          )}

          <h2
            className={`text-base font-bold ${
              isPending
                ? "text-amber-900"
                : isPassed
                ? "text-emerald-900"
                : "text-slate-900"
            }`}
          >
            {isPending
              ? t("quiz_result_status_pending")
              : isPassed
              ? t("quiz_result_status_passed")
              : t("quiz_result_status_failed")}
          </h2>

          <div className="mt-2.5 flex items-center justify-center gap-5">
            <div>
              <span className="text-2xl font-bold text-slate-900">{score}</span>
              <span className="text-xs text-slate-500 font-semibold ml-1">
                {t("quiz_result_points_label", { total: totalPoints })}
              </span>
            </div>
            <div className="h-5 w-px bg-slate-300" />
            <div>
              <span className="text-2xl font-bold text-slate-900">{percentage}%</span>
              <span className="text-xs text-slate-500 font-semibold ml-1">
                {t("quiz_result_accuracy_rate")}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Question Review */}
        {data.canSeeCorrectAnswers ? (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {t("quiz_result_details_heading")}
            </h2>

            {questions.map((q, idx) => {
              const studentAns = answersMap.get(q._id);
              const maxPts = q.points ?? 0;
              const earnedPts = studentAns?.score;
              const isFullCorrect = earnedPts !== undefined ? earnedPts === maxPts && maxPts > 0 : correctMap.get(q._id) === true;
              const isPartial = earnedPts !== undefined ? earnedPts > 0 && earnedPts < maxPts : false;

              return (
                <div
                  key={q._id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                        {t("quiz_result_question_n", { number: idx + 1 })}
                      </span>
                      <span className="text-xs text-slate-500">
                        {earnedPts !== undefined
                          ? t("quiz_result_earned_points_n", { earned: earnedPts, max: q.points })
                          : t("quiz_result_points_n", { points: q.points })}
                      </span>
                    </div>

                    <div>
                      {q.questionType === "text" ? (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                          {t("quiz_type_essay")}
                        </span>
                      ) : isFullCorrect ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" />
                          {t("quiz_result_badge_correct")}
                        </span>
                      ) : isPartial ? (
                        <span className="flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" />
                          {t("quiz_result_badge_partial")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-full">
                          <X className="w-3.5 h-3.5" />
                          {t("quiz_result_badge_incorrect")}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 leading-relaxed">
                    {q.title}
                  </h3>

                  {/* Options Review */}
                  {q.questionType === "choice" ? (
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const isStudentSelected = studentAns?.selectedOptionIds?.includes(opt._id);
                        const isOptCorrect = opt.isCorrect;

                        let styleClass = "bg-slate-50 border-slate-200 text-slate-600";
                        if (isOptCorrect && isStudentSelected) {
                          // Đúng và đã chọn -> Xanh lá
                          styleClass = "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold";
                        } else if (isOptCorrect && !isStudentSelected) {
                          // Đáp án đúng nhưng chưa chọn -> Xanh viền
                          styleClass = "bg-emerald-50/50 border-dashed border-emerald-400 text-emerald-800";
                        } else if (!isOptCorrect && isStudentSelected) {
                          // Chọn sai -> Đỏ
                          styleClass = "bg-rose-50 border-rose-300 text-rose-900 font-semibold";
                        }

                        return (
                          <div
                            key={opt._id}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${styleClass}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-5 h-5 ${q.allowMultiple ? "rounded-md" : "rounded-full"} bg-white border border-slate-200 flex items-center justify-center font-bold text-[10px]`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{opt.text}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isStudentSelected && (
                                <span className="text-[10px] uppercase font-bold text-slate-500">
                                  {t("quiz_result_your_choice")}
                                </span>
                              )}
                              {isOptCorrect && (
                                <span className="text-[10px] uppercase font-bold text-emerald-600">
                                  {t("quiz_result_correct_choice")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Essay Review */
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                      <p className="font-semibold text-slate-500">{t("quiz_result_your_answer")}</p>
                      <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {studentAns?.textAnswer || <span className="italic text-slate-400">{t("quiz_result_no_answer")}</span>}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-xs">
            <HelpCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              {t("quiz_result_hidden_notice")}
            </p>
          </div>
        )}
      </div>

      {/* Navigator Popover */}
      {data.canSeeCorrectAnswers && (
        <QuizNavigator
          isOpen={showNavigator}
          onClose={() => setShowNavigator(false)}
          questions={questions}
          answers={answersMap}
          currentIndex={currentIndex}
          onSelectQuestion={(idx) => setCurrentIndex(idx)}
          mode="results"
          correctMap={correctMap}
        />
      )}
    </div>
  );
}
