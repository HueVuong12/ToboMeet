/**
 * QuizEssayGrading.tsx — Trưởng nhóm chấm câu tự luận
 */
import React, { useState } from "react";
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
import {
  useGetQuizResultsQuery,
  useGradeEssayQuestionMutation,
} from "../../../lib/redux/api/assignmentsApi";
import { Assignment, Submission, QuizQuestion } from "../types";

interface QuizEssayGradingProps {
  assignment: Assignment;
  roomMembers: { userId?: string; supabaseId?: string; displayName?: string; name?: string }[];
  onBack: () => void;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

interface EssayScore {
  questionId: string;
  score: string;
}

interface MemberGradingState {
  essayScores: EssayScore[];
}

export default function QuizEssayGrading({
  assignment,
  roomMembers,
  onBack,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: QuizEssayGradingProps) {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useGetQuizResultsQuery(assignment._id);
  const [gradeEssay, { isLoading: isGrading }] = useGradeEssayQuestionMutation();

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [gradingState, setGradingState] = useState<Record<string, MemberGradingState>>({});

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  const submissions: Submission[] = data?.submissions ?? [];
  const questions: QuizQuestion[] = data?.questions ?? [];
  const essayQuestions = questions.filter((q) => q.questionType === "text");

  const getName = (studentId: string): string => {
    const member = roomMembers.find(
      (m) => m.userId === studentId || m.supabaseId === studentId,
    );
    return member?.displayName ?? member?.name ?? studentId.slice(0, 8);
  };

  const getGradingStatus = (sub: Submission): "not_submitted" | "pending" | "graded" => {
    if (!sub.submittedAt) return "not_submitted";
    if (sub.gradingStatus === "graded") return "graded";
    return "pending";
  };

  const initScores = (studentId: string, sub: Submission): EssayScore[] => {
    return essayQuestions.map((q) => {
      const ans = (sub.quizAnswers ?? []).find((a) => a.questionId === q._id);
      // Nếu đã chấm, không có score riêng từng câu — chỉ hiện tổng
      return {
        questionId: q._id,
        score: ans ? "" : "",
      };
    });
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudent(studentId);
    if (!gradingState[studentId]) {
      const sub = submissions.find((s) => s.studentId === studentId);
      if (sub) {
        setGradingState((prev) => ({
          ...prev,
          [studentId]: { essayScores: initScores(studentId, sub) },
        }));
      }
    }
  };

  const handleScoreChange = (studentId: string, questionId: string, val: string) => {
    setGradingState((prev) => ({
      ...prev,
      [studentId]: {
        essayScores: (prev[studentId]?.essayScores ?? []).map((es) =>
          es.questionId === questionId ? { ...es, score: val } : es,
        ),
      },
    }));
  };

  const handleGrade = async (studentId: string) => {
    const state = gradingState[studentId];
    if (!state) return;

    const sub = submissions.find((s) => s.studentId === studentId);
    if (!sub) return;

    // Validate
    const essayScores: { questionId: string; score: number }[] = [];
    for (const es of state.essayScores) {
      const q = essayQuestions.find((q) => q._id === es.questionId);
      if (!q) continue;
      const num = parseFloat(es.score);
      if (isNaN(num) || num < 0 || num > (q.points ?? 0)) {
        Alert.alert(
          t("quiz.error_title", { defaultValue: "Lỗi" }),
          t("quiz.error_score_range", {
            max: q.points ?? 0,
            defaultValue: `Điểm câu "${q.title}" phải từ 0 đến ${q.points ?? 0}`,
          }),
        );
        return;
      }
      essayScores.push({ questionId: es.questionId, score: num });
    }

    try {
      await gradeEssay({
        assignmentId: assignment._id,
        studentId,
        essayScores,
      }).unwrap();
      Alert.alert(
        t("room.success"),
        t("quiz.grade_saved", { defaultValue: "Đã lưu điểm thành công!" }),
      );
      await refetch();
      setSelectedStudent(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as Error)?.message ??
        t("assignments.toast_error_generic");
      Alert.alert(t("room.error"), msg);
    }
  };

  // Lấy đáp án tự luận của sinh viên
  const getTextAnswers = (sub: Submission): Map<string, string> => {
    const map = new Map<string, string>();
    for (const ans of sub.quizAnswers ?? []) {
      if (ans.textAnswer) map.set(ans.questionId, ans.textAnswer);
    }
    return map;
  };

  // ─── List view ────────────────────────────────────────────────────────────
  if (!selectedStudent) {
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
            <TouchableOpacity onPress={onBack} className="p-1 mr-2">
              <Feather name="arrow-left" size={20} color="#475569" />
            </TouchableOpacity>
            <Text className="font-bold text-slate-900 text-base" numberOfLines={1}>
              {t("quiz.essay_grading_title", { defaultValue: "Chấm tự luận" })}
            </Text>
          </View>
          {onOpenRightDrawer && (
            <TouchableOpacity onPress={onOpenRightDrawer} className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
              <Feather name="info" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
            {t("quiz.pending_grading", { defaultValue: "Danh sách thành viên" })}
          </Text>

          {submissions.length === 0 && (
            <View className="items-center py-12">
              <Feather name="inbox" size={36} color="#CBD5E1" />
              <Text className="text-slate-400 font-semibold text-sm mt-3">
                {t("quiz.no_submissions", { defaultValue: "Chưa có ai nộp bài" })}
              </Text>
            </View>
          )}

          {submissions.map((sub) => {
            const status = getGradingStatus(sub);
            return (
              <TouchableOpacity
                key={sub._id}
                onPress={() => {
                  if (status !== "not_submitted") handleSelectStudent(sub.studentId);
                }}
                className={`bg-white rounded-2xl border mb-3 p-4 flex-row items-center gap-3 ${
                  status === "not_submitted" ? "border-slate-100 opacity-50" : "border-slate-200 active:bg-slate-50"
                }`}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  status === "graded" ? "bg-green-100" : status === "pending" ? "bg-amber-100" : "bg-slate-100"
                }`}>
                  <Feather
                    name={status === "graded" ? "check" : status === "pending" ? "clock" : "minus"}
                    size={18}
                    color={status === "graded" ? "#16A34A" : status === "pending" ? "#F59E0B" : "#94A3B8"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900 text-sm">
                    {getName(sub.studentId)}
                  </Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {status === "graded"
                      ? t("quiz.graded_label", { score: sub.score, defaultValue: `Đã chấm — ${sub.score} điểm` })
                      : status === "pending"
                      ? t("quiz.pending_label", { defaultValue: "Chờ chấm tự luận" })
                      : t("quiz.not_submitted_label", { defaultValue: "Chưa nộp bài" })}
                  </Text>
                </View>
                {status !== "not_submitted" && (
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ─── Grading view cho 1 thành viên ───────────────────────────────────────
  const sub = submissions.find((s) => s.studentId === selectedStudent);
  if (!sub) return null;
  const textAnswers = getTextAnswers(sub);
  const state = gradingState[selectedStudent] ?? { essayScores: initScores(selectedStudent, sub) };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity onPress={() => setSelectedStudent(null)} className="p-1 mr-2">
            <Feather name="arrow-left" size={20} color="#475569" />
          </TouchableOpacity>
          <Text className="font-bold text-slate-900 text-base" numberOfLines={1}>
            {getName(selectedStudent)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {essayQuestions.map((q, idx) => {
          const textAns = textAnswers.get(q._id) ?? "";
          const scoreEntry = state.essayScores.find((es) => es.questionId === q._id);

          return (
            <View key={q._id} className="bg-white rounded-2xl border border-slate-200 mb-4 overflow-hidden">
              {/* Câu hỏi */}
              <View className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <View className="w-6 h-6 rounded-full bg-purple-100 items-center justify-center">
                    <Text className="text-[10px] font-bold text-purple-700">{idx + 1}</Text>
                  </View>
                  <Text className="text-xs font-bold text-slate-500 uppercase">
                    {t("quiz.essay_badge", { defaultValue: "Tự luận" })} — {q.points} {t("quiz.pts", { defaultValue: "điểm" })}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-slate-800">{q.title}</Text>
              </View>

              {/* Câu trả lời */}
              <View className="px-4 pt-3 pb-2">
                <Text className="text-xs font-bold text-slate-400 uppercase mb-2">
                  {t("quiz.student_answer", { defaultValue: "Câu trả lời của thành viên" })}
                </Text>
                <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
                  <Text className="text-sm text-slate-700 leading-relaxed">
                    {textAns.trim() || (
                      <Text className="italic text-slate-400">
                        {t("quiz.no_text_answer", { defaultValue: "Không có câu trả lời" })}
                      </Text>
                    )}
                  </Text>
                </View>

                {/* Nhập điểm */}
                <Text className="text-xs font-bold text-slate-400 uppercase mb-2">
                  {t("quiz.score_label", { defaultValue: `Điểm (0 – ${q.points})` })}
                </Text>
                <TextInput
                  value={scoreEntry?.score ?? ""}
                  onChangeText={(v) => handleScoreChange(selectedStudent, q._id, v)}
                  keyboardType="numeric"
                  placeholder={`0 – ${q.points}`}
                  placeholderTextColor="#94A3B8"
                  className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-2 w-32"
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View className="bg-white border-t border-slate-100 px-4 py-3">
        <TouchableOpacity
          onPress={() => handleGrade(selectedStudent)}
          disabled={isGrading}
          className="bg-[#0052FF] active:bg-blue-700 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
        >
          {isGrading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Feather name="save" size={16} color="#ffffff" />
              <Text className="font-bold text-white text-sm">
                {t("quiz.save_grade_btn", { defaultValue: "Lưu điểm tự luận" })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
