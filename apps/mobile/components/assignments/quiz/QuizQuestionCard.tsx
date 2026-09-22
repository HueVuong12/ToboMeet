import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { QuizQuestion, QuizOption } from "../types";

interface QuizQuestionCardProps {
  question: QuizQuestion;
  index: number;
  onUpdate: (updated: QuizQuestion) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function QuizQuestionCard({
  question,
  index,
  onUpdate,
  onDelete,
}: QuizQuestionCardProps) {
  const { t } = useTranslation();

  const updateField = <K extends keyof QuizQuestion>(key: K, value: QuizQuestion[K]) => {
    onUpdate({ ...question, [key]: value });
  };

  const addOption = () => {
    const newOpt: QuizOption = {
      _id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text: "",
      isCorrect: false,
    };
    onUpdate({ ...question, options: [...(question.options ?? []), newOpt] });
  };

  const updateOption = (optIdx: number, patch: Partial<QuizOption>) => {
    const updated = (question.options ?? []).map((o, i) => (i === optIdx ? { ...o, ...patch } : o));
    onUpdate({ ...question, options: updated });
  };

  const removeOption = (optIdx: number) => {
    const updated = (question.options ?? []).filter((_, i) => i !== optIdx);
    onUpdate({ ...question, options: updated });
  };

  const toggleCorrect = (optIdx: number) => {
    if (question.allowMultiple) {
      // Checkbox: toggle riêng từng đáp án
      updateOption(optIdx, { isCorrect: !question.options[optIdx].isCorrect });
    } else {
      // Radio: chỉ 1 đáp án đúng
      const updated = (question.options ?? []).map((o, i) => ({
        ...o,
        isCorrect: i === optIdx,
      }));
      onUpdate({ ...question, options: updated });
    }
  };

  return (
    <View className="bg-white rounded-2xl border border-slate-200 mb-3 overflow-hidden shadow-xs">
      {/* Header câu hỏi */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View className="flex-row items-center gap-2">
          <View className="w-7 h-7 rounded-full bg-blue-100 items-center justify-center">
            <Text className="text-xs font-bold text-blue-700">{index + 1}</Text>
          </View>
          <Text className="text-xs font-bold text-slate-500 uppercase">
            {question.questionType === "choice"
              ? t("quiz.type_choice", { defaultValue: "Trắc nghiệm" })
              : t("quiz.type_text", { defaultValue: "Tự luận" })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="p-1"
        >
          <Feather name="trash-2" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View className="px-4 pb-4">
        {/* Nội dung câu hỏi */}
        <TextInput
          value={question.title}
          onChangeText={(v) => updateField("title", v)}
          placeholder={t("quiz.question_placeholder", { defaultValue: "Nhập nội dung câu hỏi..." })}
          placeholderTextColor="#94A3B8"
          multiline
          className="text-sm text-slate-800 font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-3 min-h-[52px]"
        />

        {/* Điểm */}
        <View className="flex-row items-center gap-2 mb-3">
          <Feather name="award" size={14} color="#64748B" />
          <Text className="text-xs font-semibold text-slate-600">
            {t("quiz.points_label", { defaultValue: "Điểm:" })}
          </Text>
          <TextInput
            value={String(question.points ?? 10)}
            onChangeText={(v) => {
              const parsed = parseFloat(v);
              if (!isNaN(parsed) && parsed >= 0) updateField("points", parsed);
            }}
            keyboardType="numeric"
            className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-16 text-center"
          />
        </View>

        {/* Switches: Bắt buộc */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold text-slate-600">
            {t("quiz.required_label", { defaultValue: "Câu bắt buộc" })}
          </Text>
          <Switch
            value={question.isRequired}
            onValueChange={(v) => updateField("isRequired", v)}
            trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
            thumbColor={question.isRequired ? "#0052FF" : "#94A3B8"}
          />
        </View>

        {/* Choice-only options */}
        {question.questionType === "choice" && (
          <>
            {/* Switch: Nhiều đáp án */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-semibold text-slate-600">
                {t("quiz.allow_multiple_label", { defaultValue: "Nhiều câu trả lời" })}
              </Text>
              <Switch
                value={question.allowMultiple}
                onValueChange={(v) => updateField("allowMultiple", v)}
                trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                thumbColor={question.allowMultiple ? "#0052FF" : "#94A3B8"}
              />
            </View>

            {/* Switch: Xáo trộn đáp án */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-semibold text-slate-600">
                {t("quiz.shuffle_options_label", { defaultValue: "Sắp xếp ngẫu nhiên đáp án" })}
              </Text>
              <Switch
                value={question.shuffleOptions}
                onValueChange={(v) => updateField("shuffleOptions", v)}
                trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                thumbColor={question.shuffleOptions ? "#0052FF" : "#94A3B8"}
              />
            </View>

            {/* Danh sách đáp án */}
            <View className="mb-2">
              {(question.options ?? []).map((opt, optIdx) => (
                <View
                  key={opt._id}
                  className="flex-row items-center gap-2 mb-2"
                >
                  {/* Radio/Checkbox chọn đáp án đúng */}
                  <TouchableOpacity
                    onPress={() => toggleCorrect(optIdx)}
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      opt.isCorrect
                        ? "border-green-500 bg-green-500"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {opt.isCorrect && (
                      <Feather name="check" size={10} color="#ffffff" />
                    )}
                  </TouchableOpacity>

                  <TextInput
                    value={opt.text}
                    onChangeText={(v) => updateOption(optIdx, { text: v })}
                    placeholder={t("quiz.option_placeholder", {
                      defaultValue: `Đáp án ${optIdx + 1}`,
                    })}
                    placeholderTextColor="#94A3B8"
                    className="flex-1 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />

                  {(question.options?.length ?? 0) > 2 && (
                    <TouchableOpacity
                      onPress={() => removeOption(optIdx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Thêm đáp án */}
            <TouchableOpacity
              onPress={addOption}
              className="flex-row items-center gap-1.5 py-2"
            >
              <Feather name="plus-circle" size={14} color="#0052FF" />
              <Text className="text-xs font-bold text-[#0052FF]">
                {t("quiz.add_option", { defaultValue: "Thêm tùy chọn" })}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Text question: ghi chú */}
        {question.questionType === "text" && (
          <View className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <Text className="text-xs text-slate-400 italic">
              {t("quiz.text_answer_hint", { defaultValue: "Thành viên sẽ nhập câu trả lời văn bản tại đây" })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
