import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  title: string;
  options: QuizOption[];
  correctOptionIndex: number;
  points: number;
}

interface QuizCreateProps {
  roomId: string;
  channels?: any[];
  roomMembers?: any[];
  userId: string;
  onBack: () => void;
  onSubmit?: (payload: any) => Promise<void> | void;
  isSubmitting?: boolean;
}

export default function QuizCreate({
  roomId,
  channels = [],
  roomMembers = [],
  userId,
  onBack,
  onSubmit,
  isSubmitting = false,
}: QuizCreateProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState("15");
  const [passScore, setPassScore] = useState("70");

  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: "q_1",
      title: "",
      options: [
        { id: "opt_1", text: "" },
        { id: "opt_2", text: "" },
        { id: "opt_3", text: "" },
        { id: "opt_4", text: "" },
      ],
      correctOptionIndex: 0,
      points: 10,
    },
  ]);

  const handleAddQuestion = () => {
    const newId = `q_${Date.now()}`;
    setQuestions((prev) => [
      ...prev,
      {
        id: newId,
        title: "",
        options: [
          { id: `opt_${Date.now()}_1`, text: "" },
          { id: `opt_${Date.now()}_2`, text: "" },
          { id: `opt_${Date.now()}_3`, text: "" },
          { id: `opt_${Date.now()}_4`, text: "" },
        ],
        correctOptionIndex: 0,
        points: 10,
      },
    ]);
  };

  const handleRemoveQuestion = (qIndex: number) => {
    if (questions.length <= 1) {
      Alert.alert(t("room.notice") || "Thông báo", "Bài trắc nghiệm phải có ít nhất 1 câu hỏi");
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex));
  };

  const handleQuestionTitleChange = (qIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qIndex ? { ...q, title: text } : q))
    );
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[optIndex] = { ...newOptions[optIndex], text };
        return { ...q, options: newOptions };
      })
    );
  };

  const handleSetCorrectOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qIndex ? { ...q, correctOptionIndex: optIndex } : q
      )
    );
  };

  const handlePointsChange = (qIndex: number, text: string) => {
    const val = parseInt(text, 10) || 0;
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === qIndex ? { ...q, points: val } : q))
    );
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!title.trim()) {
      Alert.alert(t("room.error") || "Lỗi", "Vui lòng nhập tiêu đề bài trắc nghiệm");
      return;
    }

    if (status === "published") {
      for (let i = 0; i < questions.length; i++) {
        if (!questions[i].title.trim()) {
          Alert.alert(
            t("room.error") || "Lỗi",
            `Câu hỏi ${i + 1} chưa điền nội dung câu hỏi`
          );
          return;
        }
        const hasEmpty = questions[i].options.some((o) => !o.text.trim());
        if (hasEmpty) {
          Alert.alert(
            t("room.error") || "Lỗi",
            `Câu hỏi ${i + 1} có đáp án chưa nhập nội dung`
          );
          return;
        }
      }
    }

    const payload = {
      type: "quiz",
      title: title.trim(),
      description: description.trim(),
      roomId,
      createdBy: userId,
      timeLimitMinutes: parseInt(timeLimit, 10) || 0,
      passScore: parseInt(passScore, 10) || 0,
      status,
      questions,
    };

    if (onSubmit) {
      await onSubmit(payload);
    } else {
      Alert.alert(
        t("room.success") || "Thành công",
        status === "published"
          ? "Đã tạo và xuất bản bài trắc nghiệm thành công!"
          : "Đã lưu bản nháp bài trắc nghiệm!"
      );
      onBack();
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50"
    >
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="bg-white border-b border-slate-200 px-4 pb-3"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={onBack}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center mr-1"
            >
              <Feather name="arrow-left" size={20} color="#1E293B" />
            </TouchableOpacity>
            <View>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  {t("assignments.type_quiz")}
                </Text>
              </View>
              <Text className="text-base font-bold text-slate-900 mt-0.5">
                {t("assignments.quiz_create_title")}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5">
            <TouchableOpacity
              onPress={() => handleSave("draft")}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-slate-100 rounded-lg active:bg-slate-200"
            >
              <Text className="text-xs font-bold text-slate-700">
                {t("assignments.quiz_save_draft")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSave("published")}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-purple-600 rounded-lg active:bg-purple-700 shadow-xs"
            >
              <Text className="text-xs font-bold text-white">
                {t("assignments.quiz_publish")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Basic Information Card */}
        <View className="bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-xs">
          <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
            Thông tin bài trắc nghiệm
          </Text>

          <Text className="text-xs font-bold text-slate-700 mb-1">
            {t("assignments.quiz_field_title")} <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Nhập tiêu đề bài trắc nghiệm..."
            placeholderTextColor="#94A3B8"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 mb-3"
          />

          <Text className="text-xs font-bold text-slate-700 mb-1">
            {t("assignments.field_desc")}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Nhập mô tả, hướng dẫn làm bài..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 mb-3 min-h-[70px]"
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-700 mb-1">
                {t("assignments.quiz_field_time_limit")}
              </Text>
              <TextInput
                value={timeLimit}
                onChangeText={setTimeLimit}
                keyboardType="numeric"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-700 mb-1">
                {t("assignments.quiz_field_pass_score")} (%)
              </Text>
              <TextInput
                value={passScore}
                onChangeText={setPassScore}
                keyboardType="numeric"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800"
              />
            </View>
          </View>
        </View>

        {/* Questions Header */}
        <View className="flex-row items-center justify-between mb-3 px-1">
          <Text className="text-sm font-bold text-slate-800">
            Danh sách câu hỏi ({questions.length}) • {totalPoints} điểm
          </Text>
          <TouchableOpacity
            onPress={handleAddQuestion}
            className="flex-row items-center gap-1 bg-purple-50 px-2.5 py-1.5 rounded-lg active:bg-purple-100"
          >
            <Feather name="plus" size={14} color="#7E22CE" />
            <Text className="text-xs font-bold text-purple-700">
              {t("assignments.quiz_add_question")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Questions Cards */}
        {questions.map((q, qIdx) => (
          <View
            key={q.id}
            className="bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-xs"
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-2">
                <View className="w-6 h-6 rounded-full bg-purple-100 items-center justify-center">
                  <Text className="text-xs font-bold text-purple-700">
                    {qIdx + 1}
                  </Text>
                </View>
                <Text className="text-xs font-bold text-slate-700">
                  Câu hỏi {qIdx + 1}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <View className="flex-row items-center bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                  <Text className="text-[10px] text-slate-500 mr-1">Điểm:</Text>
                  <TextInput
                    value={String(q.points)}
                    onChangeText={(t) => handlePointsChange(qIdx, t)}
                    keyboardType="numeric"
                    className="text-xs font-bold text-slate-800 w-8 text-center p-0"
                  />
                </View>

                {questions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveQuestion(qIdx)}
                    className="p-1 rounded-md active:bg-red-50"
                  >
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Question Text */}
            <TextInput
              value={q.title}
              onChangeText={(text) => handleQuestionTitleChange(qIdx, text)}
              placeholder={t("assignments.quiz_question_placeholder")}
              placeholderTextColor="#94A3B8"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 mb-3"
            />

            {/* Options */}
            <Text className="text-[10px] font-bold text-slate-400 uppercase mb-2">
              Đáp án (chạm chữ cái để chọn đáp án đúng)
            </Text>

            <View className="gap-2">
              {q.options.map((opt, optIdx) => {
                const isCorrect = q.correctOptionIndex === optIdx;
                const letter = String.fromCharCode(65 + optIdx);
                return (
                  <View
                    key={opt.id}
                    className={`flex-row items-center p-2 rounded-xl border ${
                      isCorrect
                        ? "bg-emerald-50/70 border-emerald-300"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <TouchableOpacity
                      onPress={() => handleSetCorrectOption(qIdx, optIdx)}
                      className={`w-7 h-7 rounded-full items-center justify-center mr-2.5 ${
                        isCorrect
                          ? "bg-emerald-600"
                          : "bg-white border border-slate-300"
                      }`}
                    >
                      {isCorrect ? (
                        <Feather name="check" size={14} color="#ffffff" />
                      ) : (
                        <Text className="text-xs font-bold text-slate-600">
                          {letter}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TextInput
                      value={opt.text}
                      onChangeText={(text) =>
                        handleOptionTextChange(qIdx, optIdx, text)
                      }
                      placeholder={`Lựa chọn ${letter}...`}
                      placeholderTextColor="#94A3B8"
                      className="flex-1 text-xs text-slate-800 py-1"
                    />

                    {isCorrect && (
                      <View className="bg-emerald-100 px-1.5 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-emerald-700">
                          {t("assignments.quiz_correct_answer")}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={handleAddQuestion}
          activeOpacity={0.7}
          className="border border-dashed border-purple-300 bg-purple-50/50 p-3.5 rounded-2xl items-center justify-center flex-row gap-2 mt-1"
        >
          <Feather name="plus" size={16} color="#7E22CE" />
          <Text className="text-xs font-bold text-purple-700">
            {t("assignments.quiz_add_question")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
