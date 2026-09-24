import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Grid,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Check,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { socket } from "@/lib/socket";
import {
  useStartQuizMutation,
  useSubmitQuizMutation,
} from "@/lib/redux/api/assignmentsApi";
import { Assignment, QuizQuestion, QuizAnswer, QuizAttemptResponse } from "../types";
import QuizCountdown from "./QuizCountdown";
import QuizNavigator from "./QuizNavigator";

interface QuizTakeProps {
  assignment: Assignment;
  userId: string;
  onBack: () => void;
  onSubmitted: () => void;
}

export default function QuizTake({
  assignment,
  userId,
  onBack,
  onSubmitted,
}: QuizTakeProps) {
  const t = useTranslations("room.assignments_i18n");
  const [startQuiz, { isLoading: isStarting }] = useStartQuizMutation();
  const [submitQuiz, { isLoading: isSubmitting }] = useSubmitQuizMutation();

  const [attempt, setAttempt] = useState<QuizAttemptResponse | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Map<string, QuizAnswer>>(new Map());
  const [showNavigator, setShowNavigator] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Trạng thái sau khi nộp bài thành công (chỉ dùng khi allowMultipleAttempts=true)
  const [submittedResult, setSubmittedResult] = useState<{ quizScore: number; attemptNumber: number } | null>(null);
  const [isRetaking, setIsRetaking] = useState<boolean>(false);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const isSubmittingRef = useRef(isSubmitting);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const autosaveKey = `quiz_autosave_${assignment._id}_${userId}`;

  const startedAssignmentIdRef = useRef<string | null>(null);

  // Start quiz attempt
  useEffect(() => {
    if (startedAssignmentIdRef.current === assignment._id) return;
    startedAssignmentIdRef.current = assignment._id;

    const init = async () => {
      try {
        const res = await startQuiz(assignment._id).unwrap();
        setAttempt(res);
        setQuestions(res.questions || []);

        // Khôi phục auto-save từ localStorage
        const saved = localStorage.getItem(autosaveKey);
        if (saved) {
          try {
            const parsed: QuizAnswer[] = JSON.parse(saved);
            const map = new Map<string, QuizAnswer>();
            parsed.forEach((a) => map.set(a.questionId, a));
            setAnswers(map);
          } catch {
            // ignore parse error
          }
        } else if (res.submission?.quizAnswers?.length) {
          const map = new Map<string, QuizAnswer>();
          res.submission.quizAnswers.forEach((a: QuizAnswer) => map.set(a.questionId, a));
          setAnswers(map);
        }
      } catch (err: any) {
        setError(err?.data?.message || err?.message || t("quiz_take_init_error"));
      }
    };

    init();
  }, [assignment._id, startQuiz, autosaveKey, t]);

  // Persist answers to localStorage
  const persistAnswers = useCallback(
    (nextMap: Map<string, QuizAnswer>) => {
      try {
        const arr = Array.from(nextMap.values());
        localStorage.setItem(autosaveKey, JSON.stringify(arr));
      } catch {
        // ignore storage error
      }
    },
    [autosaveKey]
  );

  // Handle selecting option
  const handleSelectOption = (question: QuizQuestion, optionId: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const existing = next.get(question._id) || {
        questionId: question._id,
        selectedOptionIds: [],
        textAnswer: "",
      };

      let newSelected: string[];
      if (question.allowMultiple) {
        if (existing.selectedOptionIds.includes(optionId)) {
          newSelected = existing.selectedOptionIds.filter((id) => id !== optionId);
        } else {
          newSelected = [...existing.selectedOptionIds, optionId];
        }
      } else {
        newSelected = [optionId];
      }

      next.set(question._id, { ...existing, selectedOptionIds: newSelected });
      persistAnswers(next);
      return next;
    });
  };

  // Handle text essay answer
  const handleTextAnswer = (questionId: string, text: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionId) || {
        questionId,
        selectedOptionIds: [],
        textAnswer: "",
      };
      next.set(questionId, { ...existing, textAnswer: text });
      persistAnswers(next);
      return next;
    });
  };

  // Submit
  const handleSubmit = async () => {
    setShowConfirmModal(false);
    const answersArray = Array.from(answersRef.current.values());
    const allowMultipleAttempts = attempt?.settings?.allowMultipleAttempts ?? false;

    try {
      const result = await submitQuiz({
        id: assignment._id,
        answers: answersArray,
      }).unwrap();

      try {
        localStorage.removeItem(autosaveKey);
      } catch {}

      if (allowMultipleAttempts) {
        // Hiển thị màn hình kết quả lần vừa làm + nút Làm lại
        setSubmittedResult({
          quizScore: result?.quizScore ?? 0,
          attemptNumber: attempt?.submission?.attemptNumber ?? 1,
        });
      } else {
        // Flow cũ: chuyển sang quiz_result
        toast.success(t("quiz_take_submit_success"));
        onSubmitted();
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("quiz_take_submit_error"));
    }
  };

  const handleAutoSubmit = useCallback(async (customMsg?: string) => {
    if (isSubmittingRef.current) return;
    setShowConfirmModal(false);
    const answersArray = Array.from(answersRef.current.values());

    try {
      await submitQuiz({
        id: assignment._id,
        answers: answersArray,
      }).unwrap();

      try {
        localStorage.removeItem(autosaveKey);
      } catch {}
      toast.info(customMsg || t("toast_quiz_closed_auto_submitting"));
      onSubmitted();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("quiz_take_submit_error"));
    }
  }, [assignment._id, submitQuiz, autosaveKey, onSubmitted, t]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const handleAssignmentUpdated = (data: any) => {
      const eventAssignId = String(data.assignmentId || data.assignment?._id || data._id || "");
      if (eventAssignId !== String(assignment._id)) return;

      const updatedAssignment = data.assignment;
      if (!updatedAssignment) return;

      const newSettings = updatedAssignment.quizSettings;

      // 1. Nếu bài trắc nghiệm bị đóng phản hồi (acceptResponses = false hoặc closeDate đã qua)
      if (newSettings && newSettings.acceptResponses === false) {
        toast.warning(t("toast_quiz_closed_auto_submitting"));
        handleAutoSubmit();
        return;
      }

      if (newSettings?.closeDate && new Date(newSettings.closeDate).getTime() <= Date.now()) {
        toast.warning(t("toast_quiz_closed_auto_submitting"));
        handleAutoSubmit();
        return;
      }

      // 2. Cập nhật settings & thời hạn trong attempt mà TUYỆT ĐỐI KHÔNG làm mất answers đang chọn
      setAttempt((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            ...(newSettings || {}),
          },
        };
      });

      toast.info(t("toast_quiz_updated", { title: updatedAssignment.title || assignment.title }));
    };

    const handleAssignmentDeleted = (data: any) => {
      const deletedId = String(data.assignmentId || data._id || "");
      if (deletedId === String(assignment._id)) {
        try {
          localStorage.removeItem(autosaveKey);
        } catch {}
        toast.error(t("toast_deleted_by_system"));
        onBack();
      }
    };

    socket.on("assignment_updated", handleAssignmentUpdated);
    socket.on("assignment_deleted", handleAssignmentDeleted);

    return () => {
      socket.off("assignment_updated", handleAssignmentUpdated);
      socket.off("assignment_deleted", handleAssignmentDeleted);
    };
  }, [assignment._id, assignment.title, autosaveKey, handleAutoSubmit, t, onBack]);

  const handleTimeUp = () => {
    toast.warning(t("quiz_take_time_up"));
    handleSubmit();
  };

  // Xử lý Làm lại bài: reset state và gọi startQuiz để tạo attempt mới
  const handleRetake = async () => {
    setIsRetaking(true);
    setSubmittedResult(null);
    setAnswers(new Map());
    setCurrentIndex(0);
    setError(null);
    try {
      const res = await startQuiz(assignment._id).unwrap();
      setAttempt(res);
      setQuestions(res.questions || []);
      try {
        localStorage.removeItem(autosaveKey);
      } catch {}
    } catch (err: any) {
      setError(err?.data?.message || err?.message || t("quiz_take_init_error"));
    } finally {
      setIsRetaking(false);
    }
  };

  if (isStarting || isRetaking || !attempt) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
        {error ? (
          <div className="text-center max-w-sm">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">{t("quiz_take_error_title")}</h2>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {t("quiz_back")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#0052FF] animate-spin" />
            <p className="text-xs font-semibold text-slate-500">{t("quiz_take_preparing")}</p>
          </div>
        )}
      </div>
    );
  }

  // Màn hình kết quả tức thì sau khi nộp (chỉ khi allowMultipleAttempts = true)
  if (submittedResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center max-w-sm w-full space-y-5">
          <div className="w-14 h-14 rounded-full bg-emerald-50 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {t("quiz_take_submit_success")}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t("quiz_attempt_number", { number: submittedResult.attemptNumber })}
            </p>
            <p className="text-2xl font-bold text-[#0052FF] mt-3">
              {submittedResult.quizScore} {t("quiz_result_points_label", { total: "" }).replace(" / ", "").trim()}
            </p>
            <p className="text-xs text-slate-500 mt-1">{t("quiz_best_score_label")}</p>
          </div>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleRetake}
              className="w-full py-2.5 rounded-xl bg-[#0052FF] hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-sm"
            >
              {t("quiz_retake_btn")}
            </button>
            <button
              type="button"
              onClick={() => {
                toast.success(t("quiz_take_submit_success"));
                onSubmitted();
              }}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold transition-colors"
            >
              {t("quiz_view_result_btn")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers.get(currentQuestion._id) : undefined;

  const answeredCount = questions.filter((q) => {
    const a = answers.get(q._id);
    return (
      (a?.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a?.textAnswer && a.textAnswer.trim().length > 0)
    );
  }).length;

  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Top Header */}
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
            <h1 className="text-sm font-bold text-slate-900 truncate">{assignment.title}</h1>
            <p className="text-[11px] text-slate-500">
              {t("quiz_take_question_header", {
                current: currentIndex + 1,
                total: questions.length,
                points: currentQuestion?.points || 1,
              })}
            </p>
          </div>
        </div>

        {/* Right side: Countdown & Navigator Button */}
        <div className="flex items-center gap-2.5">
          {/* Countdown */}
          {attempt.submission?.startedAt && (attempt.settings?.timeLimitMinutes ?? 0) > 0 && (
            <QuizCountdown
              startedAt={attempt.submission.startedAt}
              timeLimitMinutes={attempt.settings!.timeLimitMinutes}
              onTimeUp={handleTimeUp}
            />
          )}

          {/* Ô nhỏ hiển thị số lượng câu hỏi đã chọn bên phải */}
          <button
            type="button"
            onClick={() => setShowNavigator(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
            title={t("quiz_take_view_questions_tooltip")}
          >
            <Grid className="w-3.5 h-3.5 text-[#0052FF]" />
            <span>
              {answeredCount}/{questions.length}
            </span>
          </button>

          {/* Submit button */}
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-[#0052FF] hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors"
          >
            <span>{t("quiz_take_submit_btn")}</span>
          </button>
        </div>
      </div>

      {/* Main Question Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full flex flex-col justify-between">
        {currentQuestion && (
          <div className="space-y-4">
            {/* Question Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0052FF] font-bold text-[11px]">
                  {t("quiz_take_question_badge", { number: currentIndex + 1 })}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {currentQuestion.questionType === "text"
                    ? t("quiz_type_essay")
                    : currentQuestion.allowMultiple
                    ? t("quiz_choice_multi_label")
                    : t("quiz_choice_single_label")}
                </span>
              </div>

              <h2 className="text-sm font-semibold text-slate-900 leading-relaxed">
                {currentQuestion.title}
              </h2>

              {/* Options */}
              {currentQuestion.questionType === "choice" ? (
                <div className="space-y-2.5 pt-1">
                  {currentQuestion.options.map((opt, optIdx) => {
                    const isSelected = currentAnswer?.selectedOptionIds?.includes(opt._id);

                    return (
                      <button
                        key={opt._id}
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion, opt._id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                          isSelected
                            ? "bg-blue-50/80 border-[#0052FF] text-[#0052FF] shadow-2xs"
                            : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/70 hover:border-slate-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 ${
                            currentQuestion.allowMultiple ? "rounded-md" : "rounded-full"
                          } flex items-center justify-center flex-shrink-0 text-[11px] font-bold transition-all ${
                            isSelected
                              ? "bg-[#0052FF] text-white shadow-2xs"
                              : "bg-white border border-slate-300 text-slate-500"
                          }`}
                        >
                          {currentQuestion.allowMultiple ? (
                            isSelected ? <Check className="w-3 h-3" /> : String.fromCharCode(65 + optIdx)
                          ) : (
                            isSelected ? <span className="w-2 h-2 rounded-full bg-white" /> : String.fromCharCode(65 + optIdx)
                          )}
                        </div>
                        <span className="text-xs font-normal leading-normal flex-1">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Essay input */
                <div className="pt-1">
                  <textarea
                    rows={5}
                    value={currentAnswer?.textAnswer || ""}
                    onChange={(e) => handleTextAnswer(currentQuestion._id, e.target.value)}
                    placeholder={t("quiz_take_essay_placeholder")}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all leading-relaxed resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Prev / Next Nav */}
        <div className="flex items-center justify-between py-6 mt-6 border-t border-slate-200">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t("quiz_take_prev_btn")}</span>
          </button>

          <span className="text-xs font-semibold text-slate-500">
            {currentIndex + 1} / {questions.length}
          </span>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0052FF] hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <span>{t("quiz_take_next_btn")}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
            >
              <span>{t("quiz_take_finish_btn")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigator Slide-over */}
      <QuizNavigator
        isOpen={showNavigator}
        onClose={() => setShowNavigator(false)}
        questions={questions}
        answers={answers}
        currentIndex={currentIndex}
        onSelectQuestion={(idx) => setCurrentIndex(idx)}
        mode="taking"
      />

      {/* Confirm Submit Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t("quiz_take_confirm_title")}</h2>
              {unansweredCount > 0 ? (
                <p className="text-xs text-rose-500 font-semibold mt-1">
                  {t("quiz_take_confirm_unanswered", { count: unansweredCount })}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  {t("quiz_take_confirm_all_answered", { count: questions.length })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {t("quiz_take_continue_btn")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#0052FF] hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {isSubmitting ? t("quiz_take_submitting") : t("quiz_take_confirm_submit_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
