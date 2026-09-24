/**
 * QuizResult.tsx — Màn hình kết quả bài kiểm tra
 * Hiển thị điểm, trạng thái đạt/không đạt, đáp án (nếu được phép)
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useGetQuizResultsQuery } from "../../../lib/redux/api/assignmentsApi";
import { Assignment, QuizAnswer, QuizQuestion } from "../types";
import QuizNavigator from "./QuizNavigator";

interface QuizResultProps {
  assignment: Assignment;
  userId: string;
  onBack: () => void;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

export default function QuizResult({
  assignment,
  userId,
  onBack,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: QuizResultProps) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGetQuizResultsQuery(assignment._id);
  const [showNavigator, setShowNavigator] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ─── Loading / Error ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center px-8">
        <Feather name="alert-circle" size={40} color="#EF4444" />
        <Text className="text-slate-700 font-semibold text-sm mt-3 text-center">
          {t("quiz.result_error", { defaultValue: "Không thể tải kết quả" })}
        </Text>
        <TouchableOpacity onPress={onBack} className="mt-4 bg-slate-100 px-6 py-2.5 rounded-xl">
          <Text className="font-bold text-slate-700 text-sm">
            {t("assignments.back_btn", { defaultValue: "Quay lại" })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Chờ kết quả ─────────────────────────────────────────────────────────
  if (data.canSeeScore === false) {
    return (
      <View className="flex-1 bg-slate-50">
        <ResultHeader
          onBack={onBack}
          title={assignment.title}
          onOpenLeftDrawer={onOpenLeftDrawer}
          onOpenRightDrawer={onOpenRightDrawer}
          onOpenNavigator={undefined}
        />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-amber-50 border border-amber-100 items-center justify-center mb-4">
            <Feather name="clock" size={36} color="#F59E0B" />
          </View>
          <Text className="font-bold text-slate-900 text-lg text-center mb-2">
            {t("quiz.waiting_results_title", { defaultValue: "Đã nộp bài thành công!" })}
          </Text>
          <Text className="text-slate-500 text-sm text-center leading-relaxed">
            {data.message ?? t("quiz.waiting_results_msg", {
              defaultValue: "Kết quả sẽ được hiển thị sau khi bài kiểm tra đóng",
            })}
          </Text>
        </View>
      </View>
    );
  }

  // ─── Kết quả đầy đủ ──────────────────────────────────────────────────────
  const score = data.score ?? data.quizScore ?? 0;
  const totalPoints = data.totalPoints ?? 0;
  const passScore = data.passScore ?? 0;
  const isPassed = score >= passScore && passScore > 0;
  const gradingStatus = data.gradingStatus as string | null | undefined;
  const isPending = gradingStatus === "pending_manual";
  const questions: QuizQuestion[] = (data.questions ?? []) as QuizQuestion[];
  const quizAnswers: QuizAnswer[] = (data.quizAnswers ?? []) as QuizAnswer[];
  const answersMap = new Map(quizAnswers.map((a) => [a.questionId, a]));
  const canSeeAnswers = !!data.canSeeCorrectAnswers;

  // Tính correctMap cho Navigator
  const correctMap = new Map<string, boolean | null>();
  if (canSeeAnswers) {
    for (const q of questions) {
      if (q.questionType === "text") {
        correctMap.set(q._id, null); // xám
      } else {
        const ans = answersMap.get(q._id);
        const correctIds = (q.options ?? []).filter((o: { isCorrect?: boolean }) => o.isCorrect).map((o: { _id: string }) => o._id);
        const selectedIds = ans?.selectedOptionIds ?? [];
        const isCorrect =
          correctIds.length > 0 &&
          correctIds.every((id: string) => selectedIds.includes(id)) &&
          selectedIds.every((id: string) => correctIds.includes(id));
        correctMap.set(q._id, isCorrect);
      }
    }
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ResultHeader
        onBack={onBack}
        title={assignment.title}
        onOpenLeftDrawer={onOpenLeftDrawer}
        onOpenRightDrawer={onOpenRightDrawer}
        onOpenNavigator={canSeeAnswers ? () => setShowNavigator(true) : undefined}
        questionCount={questions.length}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Score card ─── */}
        <View
          className={`rounded-2xl border p-5 mb-4 items-center ${
            isPending
              ? "bg-amber-50 border-amber-100"
              : isPassed
              ? "bg-green-50 border-green-100"
              : "bg-red-50 border-red-100"
          }`}
        >
          <View
            className={`w-20 h-20 rounded-full items-center justify-center mb-3 ${
              isPending ? "bg-amber-100" : isPassed ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <Feather
              name={isPending ? "clock" : isPassed ? "award" : "x-circle"}
              size={36}
              color={isPending ? "#F59E0B" : isPassed ? "#16A34A" : "#EF4444"}
            />
          </View>

          <Text
            className={`text-3xl font-bold mb-1 ${
              isPending ? "text-amber-700" : isPassed ? "text-green-700" : "text-red-700"
            }`}
          >
            {score}
            <Text className="text-xl font-semibold text-slate-400"> / {totalPoints}</Text>
          </Text>

          <Text
            className={`text-sm font-bold ${
              isPending ? "text-amber-600" : isPassed ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPending
              ? t("quiz.status_pending", { defaultValue: "Chờ chấm tự luận" })
              : isPassed
              ? t("quiz.status_passed", { defaultValue: "Đạt" })
              : t("quiz.status_failed", { defaultValue: "Không đạt" })}
          </Text>

          {passScore > 0 && (
            <Text className="text-xs text-slate-500 mt-1">
              {t("quiz.pass_score_info", {
                pass: passScore,
                total: totalPoints,
                defaultValue: `Điểm đạt: ${passScore} / ${totalPoints}`,
              })}
            </Text>
          )}
        </View>

        {/* ─── Chi tiết từng câu (nếu được phép xem) ─── */}
        {canSeeAnswers && questions.length > 0 && (
          <>
            <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
              {t("quiz.answer_detail", { defaultValue: "Chi tiết câu trả lời" })}
            </Text>

            {questions.map((q, idx) => {
              const ans = answersMap.get(q._id);
              const selectedIds = ans?.selectedOptionIds ?? [];
              const isCorrect = correctMap.get(q._id);
              const isEssay = q.questionType === "text";

              return (
                <View
                  key={q._id}
                  className={`bg-white rounded-2xl border mb-3 overflow-hidden ${
                    isCorrect === true
                      ? "border-green-200"
                      : isCorrect === false
                      ? "border-red-200"
                      : "border-slate-200"
                  }`}
                >
                  {/* Câu hỏi header */}
                  <View
                    className={`flex-row items-center gap-2 px-4 py-2.5 ${
                      isCorrect === true
                        ? "bg-green-50"
                        : isCorrect === false
                        ? "bg-red-50"
                        : "bg-slate-50"
                    }`}
                  >
                    <View className="w-6 h-6 rounded-full bg-white border border-slate-200 items-center justify-center">
                      <Text className="text-[10px] font-bold text-slate-600">{idx + 1}</Text>
                    </View>
                    <Text className="flex-1 text-xs font-bold text-slate-700" numberOfLines={2}>
                      {q.title}
                    </Text>
                    {!isEssay && (
                      <Feather
                        name={isCorrect ? "check-circle" : "x-circle"}
                        size={16}
                        color={isCorrect ? "#16A34A" : "#EF4444"}
                      />
                    )}
                    {isEssay && (
                      <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                        <Text className="text-[10px] font-semibold text-slate-600">
                          {t("quiz.essay_badge", { defaultValue: "Tự luận" })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="px-4 py-3">
                    {isEssay ? (
                      <Text className="text-sm text-slate-700 italic">
                        {ans?.textAnswer?.trim()
                          ? ans.textAnswer
                          : t("quiz.no_text_answer", { defaultValue: "Không có câu trả lời" })}
                      </Text>
                    ) : (
                      (q.options ?? []).map((opt) => {
                        const isSelected = selectedIds.includes(opt._id);
                        const isOptCorrect = opt.isCorrect;
                        return (
                          <View
                            key={opt._id}
                            className={`flex-row items-center gap-2 py-1.5 px-2 rounded-lg mb-1 ${
                              isOptCorrect
                                ? "bg-green-50"
                                : isSelected && !isOptCorrect
                                ? "bg-red-50"
                                : ""
                            }`}
                          >
                            <Feather
                              name={
                                isOptCorrect
                                  ? "check-circle"
                                  : isSelected
                                  ? "x-circle"
                                  : "circle"
                              }
                              size={14}
                              color={
                                isOptCorrect
                                  ? "#16A34A"
                                  : isSelected
                                  ? "#EF4444"
                                  : "#CBD5E1"
                              }
                            />
                            <Text
                              className={`flex-1 text-xs font-medium ${
                                isOptCorrect
                                  ? "text-green-800"
                                  : isSelected
                                  ? "text-red-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {opt.text}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Navigator */}
      {canSeeAnswers && (
        <QuizNavigator
          visible={showNavigator}
          onClose={() => setShowNavigator(false)}
          questions={questions}
          answers={answersMap}
          currentIndex={currentIndex}
          onSelectQuestion={setCurrentIndex}
          mode="results"
          correctMap={correctMap}
        />
      )}
    </View>
  );
}

// ─── Sub-component: Header ────────────────────────────────────────────────────

interface ResultHeaderProps {
  onBack: () => void;
  title: string;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
  onOpenNavigator?: () => void;
  questionCount?: number;
}

function ResultHeader({
  onBack,
  title,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  onOpenNavigator,
  questionCount,
}: ResultHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        {onOpenLeftDrawer ? (
          <TouchableOpacity onPress={onOpenLeftDrawer} className="p-1 mr-2">
            <Feather name="menu" size={24} color="#1E293B" />
          </TouchableOpacity>
        ) : (
          <View className="p-1 mr-2">
            <Feather name="menu" size={24} color="#1E293B" />
          </View>
        )}
        <TouchableOpacity onPress={onBack} className="p-1 mr-2">
          <Feather name="arrow-left" size={20} color="#475569" />
        </TouchableOpacity>
        <Text className="font-bold text-slate-900 text-base flex-shrink" numberOfLines={1}>
          {t("quiz.result_title", { defaultValue: "Kết quả kiểm tra" })}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {onOpenNavigator && (
          <TouchableOpacity
            onPress={onOpenNavigator}
            className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
          >
            <Feather name="grid" size={14} color="#334155" />
            {questionCount !== undefined && (
              <Text className="text-xs font-bold text-slate-700">{questionCount}</Text>
            )}
          </TouchableOpacity>
        )}
        {onOpenRightDrawer ? (
          <TouchableOpacity onPress={onOpenRightDrawer} className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
            <Feather name="info" size={16} color="#64748B" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
