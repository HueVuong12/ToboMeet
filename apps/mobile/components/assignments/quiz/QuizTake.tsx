/**
 * QuizTake.tsx — Màn hình làm bài trắc nghiệm (Thành viên)
 * Countdown + Navigator tách ra file riêng để giữ file này ~350 dòng
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStartQuizMutation, useSubmitQuizMutation } from "../../../lib/redux/api/assignmentsApi";
import { Assignment, QuizQuestion, QuizAnswer, QuizAttemptResponse } from "../types";
import QuizCountdown from "./QuizCountdown";
import QuizNavigator from "./QuizNavigator";

interface QuizTakeProps {
  assignment: Assignment;
  userId: string;
  onBack: () => void;
  onSubmitted: () => void;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

function shuffleWithSeed<T>(arr: T[], seed: string): T[] {
  // Deterministic shuffle dựa trên seed — đảm bảo thứ tự nhất quán khi reload
  const seedNum = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = ((seedNum * (i + 1)) ^ (i * 31337)) % (i + 1);
    const safeJ = ((j % (i + 1)) + (i + 1)) % (i + 1);
    [copy[i], copy[safeJ]] = [copy[safeJ], copy[i]];
  }
  return copy;
}

const AUTOSAVE_KEY_PREFIX = "quiz_autosave_";

export default function QuizTake({
  assignment,
  userId,
  onBack,
  onSubmitted,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: QuizTakeProps) {
  const { t } = useTranslation();
  const [startQuiz, { isLoading: isStarting }] = useStartQuizMutation();
  const [submitQuiz, { isLoading: isSubmitting }] = useSubmitQuizMutation();

  const [attempt, setAttempt] = useState<QuizAttemptResponse | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<string, QuizAnswer>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const autosaveKey = `${AUTOSAVE_KEY_PREFIX}${assignment._id}_${userId}`;

  // ─── Khởi động: gọi startQuiz ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const result = await startQuiz(assignment._id).unwrap() as QuizAttemptResponse;
        if (cancelled) return;

        // Áp dụng shuffle nếu cần
        let orderedQuestions = result.questions;
        if (result.settings?.shuffleQuestions && result.submission.shuffleSeed) {
          orderedQuestions = shuffleWithSeed(result.questions, result.submission.shuffleSeed);
        }
        setQuestions(orderedQuestions);
        setAttempt(result);

        // Khôi phục auto-save từ AsyncStorage
        const saved = await AsyncStorage.getItem(autosaveKey);
        if (saved) {
          const parsed: QuizAnswer[] = JSON.parse(saved) as QuizAnswer[];
          const map = new Map<string, QuizAnswer>(parsed.map((a: QuizAnswer) => [a.questionId, a]));
          setAnswers(map);
        } else if (result.submission.quizAnswers?.length) {
          // Khôi phục từ server (attempt trước)
          const quizAnswersTyped = result.submission.quizAnswers as QuizAnswer[];
          const map = new Map<string, QuizAnswer>(quizAnswersTyped.map((a: QuizAnswer) => [a.questionId, a]));
          setAnswers(map);
        }

      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            (err as { data?: { message?: string }; message?: string })?.data?.message ??
            (err as Error)?.message ??
            t("assignments.toast_error_generic");
          setError(msg);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment._id]);

  // ─── Auto-save mỗi khi answers thay đổi ──────────────────────────────────
  useEffect(() => {
    if (answers.size === 0) return;
    const arr = Array.from(answers.values());
    AsyncStorage.setItem(autosaveKey, JSON.stringify(arr)).catch(() => {
      // Bỏ qua lỗi auto-save
    });
  }, [answers, autosaveKey]);

  // ─── Xử lý chọn đáp án ───────────────────────────────────────────────────
  const handleSelectOption = useCallback((question: QuizQuestion, optionId: string) => {
    setAnswers((prev) => {
      const existing = prev.get(question._id) ?? {
        questionId: question._id,
        selectedOptionIds: [],
        textAnswer: "",
      };
      let newIds: string[];

      if (question.allowMultiple) {
        // Checkbox: toggle
        if (existing.selectedOptionIds.includes(optionId)) {
          newIds = existing.selectedOptionIds.filter((id) => id !== optionId);
        } else {
          newIds = [...existing.selectedOptionIds, optionId];
        }
      } else {
        // Radio: chỉ 1
        newIds = [optionId];
      }

      const next = new Map(prev);
      next.set(question._id, { ...existing, selectedOptionIds: newIds });
      return next;
    });
  }, []);

  const handleTextAnswer = useCallback((questionId: string, text: string) => {
    setAnswers((prev) => {
      const existing = prev.get(questionId) ?? {
        questionId,
        selectedOptionIds: [],
        textAnswer: "",
      };
      const next = new Map(prev);
      next.set(questionId, { ...existing, textAnswer: text });
      return next;
    });
  }, []);

  // ─── Nộp bài ─────────────────────────────────────────────────────────────
  const doSubmit = useCallback(async (isAutoSubmit = false) => {
    const answersArr = Array.from(answers.values());

    // Validate câu bắt buộc (chỉ khi nộp thủ công)
    if (!isAutoSubmit) {
      for (const q of questions) {
        if (!q.isRequired) continue;
        const ans = answers.get(q._id);
        const hasAnswer =
          (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
          (ans?.textAnswer && ans.textAnswer.trim().length > 0);
        if (!hasAnswer) {
          Alert.alert(
            t("quiz.error_title", { defaultValue: "Chưa hoàn thành" }),
            t("quiz.required_unanswered", {
              defaultValue: `Câu ${questions.indexOf(q) + 1} là bắt buộc`,
            }),
          );
          setCurrentIndex(questions.indexOf(q));
          return;
        }
      }
    }

    try {
      await submitQuiz({ id: assignment._id, answers: answersArr }).unwrap();
      // Xóa auto-save
      await AsyncStorage.removeItem(autosaveKey);

      if (isAutoSubmit) {
        Alert.alert(
          t("quiz.time_up_title", { defaultValue: "Hết thời gian" }),
          t("quiz.auto_submitted", { defaultValue: "Bài đã được nộp tự động!" }),
        );
      } else {
        Alert.alert(
          t("room.success"),
          t("quiz.submitted_success", { defaultValue: "Nộp bài thành công!" }),
        );
      }
      onSubmitted();
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as Error)?.message ??
        t("assignments.toast_error_generic");
      Alert.alert(t("room.error"), msg);
    }
  }, [answers, questions, assignment._id, autosaveKey, submitQuiz, t, onSubmitted]);

  const handleSubmitPress = () => {
    Alert.alert(
      t("quiz.confirm_submit_title", { defaultValue: "Xác nhận nộp bài" }),
      t("quiz.confirm_submit_msg", {
        answered: answers.size,
        total: questions.length,
        defaultValue: `Bạn đã trả lời ${answers.size}/${questions.length} câu. Bạn có chắc muốn nộp bài không?`,
      }),
      [
        { text: t("assignments.cancel_btn", { defaultValue: "Hủy" }), style: "cancel" },
        {
          text: t("quiz.submit_btn", { defaultValue: "Nộp bài" }),
          onPress: () => doSubmit(false),
        },
      ],
    );
  };

  const handleTimeUp = useCallback(() => {
    doSubmit(true);
  }, [doSubmit]);

  // ─── Loading / Error states ───────────────────────────────────────────────
  if (isStarting || !attempt) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        {error ? (
          <View className="items-center px-8">
            <Feather name="alert-circle" size={40} color="#EF4444" />
            <Text className="text-slate-700 font-semibold text-sm mt-3 text-center">{error}</Text>
            <TouchableOpacity onPress={onBack} className="mt-4 bg-slate-100 px-6 py-2.5 rounded-xl">
              <Text className="font-bold text-slate-700 text-sm">
                {t("assignments.back_btn", { defaultValue: "Quay lại" })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ActivityIndicator size="large" color="#0052FF" />
            <Text className="text-slate-500 text-sm mt-3">
              {t("quiz.loading", { defaultValue: "Đang tải bài kiểm tra..." })}
            </Text>
          </>
        )}
      </View>
    );
  }

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => {
    const a = answers.get(q._id);
    return (
      (a?.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a?.textAnswer && a.textAnswer.trim().length > 0)
    );
  }).length;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
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
          <View className="flex-1 mr-2">
            <Text className="font-bold text-slate-900 text-sm" numberOfLines={1}>
              {assignment.title}
            </Text>
            <Text className="text-xs text-slate-500">
              {t("quiz.question_progress", {
                current: currentIndex + 1,
                total: questions.length,
                defaultValue: `Câu ${currentIndex + 1} / ${questions.length}`,
              })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Countdown timer */}
          {attempt.submission.startedAt && (attempt.settings?.timeLimitMinutes ?? 0) > 0 && (
            <QuizCountdown
              startedAt={attempt.submission.startedAt}
              timeLimitMinutes={attempt.settings!.timeLimitMinutes}
              onTimeUp={handleTimeUp}
            />
          )}
          {/* Navigator button - ô nhỏ bên phải hiển thị số lượng câu hỏi */}
          <TouchableOpacity
            onPress={() => setShowNavigator(true)}
            className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 active:bg-slate-200"
          >
            <Feather name="grid" size={14} color="#334155" />
            <Text className="text-xs font-bold text-slate-700">
              {answeredCount}/{questions.length}
            </Text>
          </TouchableOpacity>
          {onOpenRightDrawer ? (
            <TouchableOpacity onPress={onOpenRightDrawer} className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
              <Feather name="info" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentQuestion ? (
          <QuestionBlock
            question={currentQuestion}
            index={currentIndex}
            answer={answers.get(currentQuestion._id)}
            onSelectOption={(optId) => handleSelectOption(currentQuestion, optId)}
            onTextChange={(text) => handleTextAnswer(currentQuestion._id, text)}
            t={t}
          />
        ) : null}
      </ScrollView>

      {/* Bottom navigation */}
      <View className="bg-white border-t border-slate-100 px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className={`w-10 h-10 rounded-xl border items-center justify-center ${
            currentIndex === 0 ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-slate-100"
          }`}
        >
          <Feather name="chevron-left" size={18} color={currentIndex === 0 ? "#CBD5E1" : "#475569"} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={currentIndex === questions.length - 1}
          className={`w-10 h-10 rounded-xl border items-center justify-center ${
            currentIndex === questions.length - 1
              ? "border-slate-100 bg-slate-50"
              : "border-slate-200 bg-slate-100"
          }`}
        >
          <Feather name="chevron-right" size={18} color={currentIndex === questions.length - 1 ? "#CBD5E1" : "#475569"} />
        </TouchableOpacity>

        <View className="flex-1" />

        <TouchableOpacity
          onPress={handleSubmitPress}
          disabled={isSubmitting}
          className="flex-row items-center gap-2 bg-[#0052FF] active:bg-blue-700 px-5 py-2.5 rounded-xl"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Feather name="send" size={14} color="#ffffff" />
              <Text className="font-bold text-white text-sm">
                {t("quiz.submit_btn", { defaultValue: "Nộp bài" })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Question Navigator Modal */}
      <QuizNavigator
        visible={showNavigator}
        onClose={() => setShowNavigator(false)}
        questions={questions}
        answers={answers}
        currentIndex={currentIndex}
        onSelectQuestion={(idx) => {
          setCurrentIndex(idx);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
        mode="taking"
      />
    </View>
  );
}

// ─── QuestionBlock sub-component ──────────────────────────────────────────────

interface QuestionBlockProps {
  question: QuizQuestion;
  index: number;
  answer?: QuizAnswer;
  onSelectOption: (optId: string) => void;
  onTextChange: (text: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function QuestionBlock({
  question,
  index,
  answer,
  onSelectOption,
  onTextChange,
  t,
}: QuestionBlockProps) {
  const selectedIds = answer?.selectedOptionIds ?? [];

  return (
    <View className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 mb-3">
      {/* Số câu + bắt buộc */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-7 h-7 rounded-full bg-blue-100 items-center justify-center">
          <Text className="text-xs font-bold text-blue-700">{index + 1}</Text>
        </View>
        {question.isRequired && (
          <View className="bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-bold text-red-600">
              {t("quiz.required_badge", { defaultValue: "Bắt buộc" })}
            </Text>
          </View>
        )}
        <View className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
          <Text className="text-[10px] font-semibold text-slate-500">
            {question.points} {t("quiz.pts", { defaultValue: "điểm" })}
          </Text>
        </View>
      </View>

      {/* Câu hỏi */}
      <Text className="text-sm font-semibold text-slate-900 leading-relaxed mb-4">
        {question.title}
      </Text>

      {/* Đáp án */}
      {question.questionType === "choice" ? (
        <View className="gap-2">
          {(question.options ?? []).map((opt) => {
            const isSelected = selectedIds.includes(opt._id);
            return (
              <TouchableOpacity
                key={opt._id}
                onPress={() => onSelectOption(opt._id)}
                activeOpacity={0.7}
                className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                  isSelected
                    ? "bg-blue-50 border-blue-400"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <View
                  className={`w-5 h-5 items-center justify-center ${
                    question.allowMultiple ? "rounded-md" : "rounded-full"
                  } border-2 ${
                    isSelected ? "border-[#0052FF] bg-[#0052FF]" : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && (
                    <Feather name="check" size={10} color="#ffffff" />
                  )}
                </View>
                <Text className={`flex-1 text-sm font-medium ${isSelected ? "text-blue-800" : "text-slate-700"}`}>
                  {opt.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={answer?.textAnswer ?? ""}
          onChangeText={onTextChange}
          placeholder={t("quiz.text_answer_placeholder", { defaultValue: "Nhập câu trả lời của bạn..." })}
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={5}
          className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 min-h-[100px]"
          textAlignVertical="top"
        />
      )}
    </View>
  );
}
