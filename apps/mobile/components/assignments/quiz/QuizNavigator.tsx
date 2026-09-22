/**
 * QuizNavigator.tsx — Panel điều hướng câu hỏi (grid số)
 * Tách riêng để giữ QuizTake.tsx ngắn gọn
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { QuizQuestion, QuizAnswer } from "../types";

type NavigatorMode = "taking" | "results";

interface QuizNavigatorProps {
  visible: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  answers: Map<string, QuizAnswer>;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  mode: NavigatorMode;
  /** Kết quả đúng/sai — chỉ dùng khi mode = "results" */
  correctMap?: Map<string, boolean | null>;
}

function getCellStyle(
  idx: number,
  currentIndex: number,
  question: QuizQuestion,
  answers: Map<string, QuizAnswer>,
  mode: NavigatorMode,
  correctMap?: Map<string, boolean | null>,
): { bg: string; text: string; border: string } {
  const isActive = idx === currentIndex;

  if (mode === "results") {
    const correct = correctMap?.get(question._id);
    if (correct === null || correct === undefined) {
      // Câu tự luận hoặc chưa chấm
      return {
        bg: isActive ? "bg-slate-200" : "bg-slate-100",
        text: "text-slate-600",
        border: isActive ? "border-slate-400" : "border-slate-200",
      };
    }
    if (correct) {
      return {
        bg: isActive ? "bg-green-500" : "bg-green-100",
        text: isActive ? "text-white" : "text-green-700",
        border: isActive ? "border-green-600" : "border-green-200",
      };
    }
    return {
      bg: isActive ? "bg-red-500" : "bg-red-100",
      text: isActive ? "text-white" : "text-red-700",
      border: isActive ? "border-red-600" : "border-red-200",
    };
  }

  // Mode: taking
  const ans = answers.get(question._id);
  const isAnswered =
    (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
    (ans?.textAnswer && ans.textAnswer.trim().length > 0);

  if (isAnswered) {
    return {
      bg: isActive ? "bg-emerald-600" : "bg-emerald-100",
      text: isActive ? "text-white" : "text-emerald-800",
      border: isActive ? "border-emerald-700" : "border-emerald-300",
    };
  }

  return {
    bg: isActive ? "bg-rose-600" : "bg-rose-100",
    text: isActive ? "text-white" : "text-rose-700",
    border: isActive ? "border-rose-600" : "border-rose-300",
  };
}

export default function QuizNavigator({
  visible,
  onClose,
  questions,
  answers,
  currentIndex,
  onSelectQuestion,
  mode,
  correctMap,
}: QuizNavigatorProps) {
  const { t } = useTranslation();

  const answeredCount = questions.filter((q) => {
    const ans = answers.get(q._id);
    return (
      (ans?.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
      (ans?.textAnswer && ans.textAnswer.trim().length > 0)
    );
  }).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/40 flex-row justify-end">
        <View className="bg-white w-64 h-full shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-5 pb-3 border-b border-slate-100">
            <View>
              <Text className="font-bold text-slate-900 text-sm">
                {mode === "taking"
                  ? t("quiz.navigator_title", { defaultValue: "Câu hỏi" })
                  : t("quiz.navigator_results_title", { defaultValue: "Kết quả" })}
              </Text>
              {mode === "taking" && (
                <Text className="text-xs text-slate-500 mt-0.5">
                  {t("quiz.answered_count", {
                    count: answeredCount,
                    total: questions.length,
                    defaultValue: `Đã trả lời: ${answeredCount} / ${questions.length} câu`,
                  })}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Legend */}
          <View className="flex-row gap-3 px-4 py-2.5 border-b border-slate-100">
            {mode === "taking" ? (
              <>
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                  <Text className="text-[10px] text-slate-500">
                    {t("quiz.nav_answered", { defaultValue: "Đã trả lời" })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-3 rounded-sm bg-rose-100 border border-rose-300" />
                  <Text className="text-[10px] text-slate-500">
                    {t("quiz.nav_unanswered", { defaultValue: "Chưa trả lời" })}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-3 rounded-sm bg-green-100 border border-green-200" />
                  <Text className="text-[10px] text-slate-500">
                    {t("quiz.nav_correct", { defaultValue: "Đúng" })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-3 rounded-sm bg-red-100 border border-red-200" />
                  <Text className="text-[10px] text-slate-500">
                    {t("quiz.nav_wrong", { defaultValue: "Sai" })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
                  <Text className="text-[10px] text-slate-500">
                    {t("quiz.nav_essay", { defaultValue: "Tự luận" })}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Grid */}
          <ScrollView
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <FlatList
              data={questions}
              keyExtractor={(q) => q._id}
              numColumns={4}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const style = getCellStyle(
                  index,
                  currentIndex,
                  item,
                  answers,
                  mode,
                  correctMap,
                );
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSelectQuestion(index);
                      onClose();
                    }}
                    className={`m-1 w-12 h-12 rounded-xl border-2 items-center justify-center ${style.bg} ${style.border}`}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs font-bold ${style.text}`}>
                      {index + 1}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
