/**
 * QuizCreate.tsx — Tạo/chỉnh sửa bài kiểm tra (Trưởng nhóm)
 * Max ~400 dòng — logic nặng tách ra QuizQuestionCard & QuizSettings
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCreateAssignmentMutation, useUpdateAssignmentMutation } from "../../../lib/redux/api/assignmentsApi";
import { Assignment, QuizQuestion, QuizSettings, QuizOption } from "../types";
import QuizQuestionCard from "./QuizQuestionCard";
import QuizSettingsModal from "./QuizSettings";

interface QuizCreateProps {
  roomId: string;
  channels: { _id: string; name: string }[];
  roomMembers: { userId?: string; supabaseId?: string; displayName?: string; name?: string; role?: string }[];
  userId: string;
  assignmentToEdit?: Assignment;
  onBack: () => void;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

const DEFAULT_SETTINGS: QuizSettings = {
  timeLimitMinutes: 0,
  passScore: 0,
  shuffleQuestions: false,
  showResultsAfterSubmit: true,
  acceptingResponses: true,
  startDate: null,
  endDate: null,
  closeDate: null,
  accessControl: "organization",
};

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildDefaultQuestion(type: "choice" | "text"): QuizQuestion {
  const opts: QuizOption[] =
    type === "choice"
      ? [
          { _id: `opt_${Date.now()}_a`, text: "", isCorrect: false },
          { _id: `opt_${Date.now()}_b`, text: "", isCorrect: false },
        ]
      : [];
  return {
    _id: generateId(),
    questionType: type,
    title: "",
    points: 10,
    isRequired: false,
    shuffleOptions: false,
    allowMultiple: false,
    options: opts,
  };
}

export default function QuizCreate({
  roomId,
  channels,
  userId,
  assignmentToEdit,
  onBack,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: QuizCreateProps) {
  const { t } = useTranslation();
  const [createAssignment, { isLoading: isCreating }] = useCreateAssignmentMutation();
  const [updateAssignment, { isLoading: isUpdating }] = useUpdateAssignmentMutation();
  const isSubmitting = isCreating || isUpdating;

  // ─── Form state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState(assignmentToEdit?.title ?? "");
  const [description, setDescription] = useState(assignmentToEdit?.description ?? "");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    String(assignmentToEdit?.quizSettings?.timeLimitMinutes ?? 0),
  );
  const [passScore, setPassScore] = useState(
    String(assignmentToEdit?.quizSettings?.passScore ?? 0),
  );
  const [deadline, setDeadline] = useState<Date>(
    assignmentToEdit?.deadline ? new Date(assignmentToEdit.deadline) : (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d;
    })(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState(
    assignmentToEdit?.channelId ?? channels[0]?._id ?? "",
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    assignmentToEdit?.questions && assignmentToEdit.questions.length > 0
      ? assignmentToEdit.questions
      : [buildDefaultQuestion("choice")],
  );
  const [settings, setSettings] = useState<QuizSettings>(
    assignmentToEdit?.quizSettings ?? DEFAULT_SETTINGS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 0), 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatDeadline = (d: Date) =>
    `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  // ─── Question handlers ────────────────────────────────────────────────────
  const handleAddQuestion = useCallback((type: "choice" | "text") => {
    setShowAddMenu(false);
    setQuestions((prev) => [...prev, buildDefaultQuestion(type)]);
  }, []);

  const handleUpdateQuestion = useCallback((idx: number, updated: QuizQuestion) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  }, []);

  const handleDeleteQuestion = useCallback((idx: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) {
        Alert.alert(
          t("quiz.error_title", { defaultValue: "Lỗi" }),
          t("quiz.min_one_question", { defaultValue: "Bài kiểm tra cần ít nhất 1 câu hỏi" }),
        );
        return prev;
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, [t]);

  // ─── Validation ───────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!title.trim()) return t("quiz.error_no_title", { defaultValue: "Vui lòng nhập tiêu đề nhiệm vụ" });
    if (questions.length === 0) return t("quiz.min_one_question", { defaultValue: "Cần ít nhất 1 câu hỏi" });

    for (const q of questions) {
      if (!q.title.trim()) return t("quiz.error_empty_question", { defaultValue: "Còn câu hỏi chưa có nội dung" });
      if (q.questionType === "choice") {
        if ((q.options?.length ?? 0) < 2) {
          return t("quiz.error_min_options", { defaultValue: "Câu trắc nghiệm cần ít nhất 2 đáp án" });
        }
        const hasEmptyOpt = (q.options ?? []).some((o) => !o.text.trim());
        if (hasEmptyOpt) return t("quiz.error_empty_option", { defaultValue: "Còn đáp án chưa nhập nội dung" });
        const hasCorrect = (q.options ?? []).some((o) => o.isCorrect);
        if (!hasCorrect) return t("quiz.error_no_correct", { defaultValue: "Mỗi câu trắc nghiệm cần có ít nhất 1 đáp án đúng" });
      }
    }

    const psNum = parseFloat(passScore);
    if (!isNaN(psNum) && psNum > totalPoints) {
      return t("quiz.error_pass_score_exceeds", {
        defaultValue: `Điểm đạt (${psNum}) không được lớn hơn tổng điểm (${totalPoints})`,
      });
    }

    return null;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (status: "draft" | "published") => {
    const error = validate();
    if (error) {
      Alert.alert(t("quiz.error_title", { defaultValue: "Lỗi" }), error);
      return;
    }

    const timeLimitNum = Math.max(0, parseInt(timeLimitMinutes, 10) || 0);
    const passScoreNum = Math.max(0, parseFloat(passScore) || 0);

    const payload = {
      type: "quiz",
      title: title.trim(),
      description: description.trim(),
      roomId,
      channelId: selectedChannelId,
      channelIds: [selectedChannelId],
      deadline: deadline.toISOString(),
      status,
      gradingType: "graded",
      maxScore: totalPoints,
      attachments: [],
      recipientType: "current_and_future_members",
      submissionPolicy: "lock_after_deadline",
      createdBy: userId,
      questions,
      quizSettings: {
        ...settings,
        timeLimitMinutes: timeLimitNum,
        passScore: passScoreNum,
      },
    };

    try {
      if (assignmentToEdit) {
        await updateAssignment({ id: assignmentToEdit._id, body: payload }).unwrap();
        Alert.alert(
          t("room.success"),
          t("quiz.updated_success", { defaultValue: "Đã cập nhật bài kiểm tra!" }),
        );
      } else {
        await createAssignment(payload).unwrap();
        Alert.alert(
          t("room.success"),
          status === "published"
            ? t("quiz.published_success", { defaultValue: "Đã xuất bản bài kiểm tra!" })
            : t("quiz.draft_saved", { defaultValue: "Đã lưu nháp bài kiểm tra!" }),
        );
      }
      onBack();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string }; message?: string })?.data?.message
        ?? (err as Error)?.message
        ?? t("assignments.toast_error_generic");
      Alert.alert(t("room.error"), msg);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
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
          <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center mr-2.5">
            <Feather name="help-circle" size={16} color="#7C3AED" />
          </View>
          <Text className="font-bold text-slate-900 text-lg">
            {assignmentToEdit
              ? t("quiz.edit_title", { defaultValue: "Chỉnh sửa trắc nghiệm" })
              : t("quiz.create_title", { defaultValue: "Tạo trắc nghiệm" })}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Nút thiết đặt */}
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center"
          >
            <Feather name="settings" size={16} color="#475569" />
          </TouchableOpacity>
          {onOpenRightDrawer ? (
            <TouchableOpacity
              onPress={onOpenRightDrawer}
              className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100"
            >
              <Feather name="info" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Sub-header: back + summary */}
      <View className="bg-white border-b border-slate-100 px-4 pt-3 pb-3">
        <View className="flex-row items-center gap-2 mb-2">
          <TouchableOpacity onPress={onBack} className="p-1 -ml-1">
            <Feather name="arrow-left" size={20} color="#475569" />
          </TouchableOpacity>
          <Text className="font-bold text-slate-700 text-sm">
            {assignmentToEdit
              ? t("quiz.editing_label", { defaultValue: "Đang chỉnh sửa" })
              : t("quiz.new_quiz_label", { defaultValue: "Bài kiểm tra mới" })}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <View className="bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">
            <Text className="text-xs font-bold text-purple-700">
              {questions.length} {t("quiz.questions_count", { defaultValue: "câu" })}
            </Text>
          </View>
          <View className="bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
            <Text className="text-xs font-bold text-blue-700">
              {totalPoints} {t("quiz.total_points_label", { defaultValue: "điểm" })}
            </Text>
          </View>
          {settings.timeLimitMinutes > 0 && (
            <View className="bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
              <Text className="text-xs font-bold text-amber-700">
                {settings.timeLimitMinutes} {t("quiz.minutes_label", { defaultValue: "phút" })}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Thông tin chung ─── */}
        <View className="bg-white rounded-2xl border border-slate-100 shadow-xs mb-4 p-4">
          <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
            {t("quiz.general_info", { defaultValue: "Thông tin chung" })}
          </Text>

          {/* Tiêu đề */}
          <Text className="text-xs font-semibold text-slate-600 mb-1">
            {t("assignments.field_title", { defaultValue: "Tiêu đề" })} *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("quiz.title_placeholder", { defaultValue: "Nhập tiêu đề nhiệm vụ..." })}
            placeholderTextColor="#94A3B8"
            className="text-sm text-slate-800 font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-3"
          />

          {/* Mô tả */}
          <Text className="text-xs font-semibold text-slate-600 mb-1">
            {t("assignments.field_desc", { defaultValue: "Mô tả / Hướng dẫn nhiệm vụ" })}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("quiz.desc_placeholder", { defaultValue: "Mô tả / Hướng dẫn nhiệm vụ (tuỳ chọn)..." })}
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-3 min-h-[72px]"
            textAlignVertical="top"
          />

          {/* Hạn chót */}
          <Text className="text-xs font-semibold text-slate-600 mb-1">
            {t("assignments.deadline_label", { defaultValue: "Hạn chót" })}
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-3"
          >
            <Feather name="calendar" size={14} color="#0052FF" />
            <Text className="text-sm font-medium text-slate-800">{formatDeadline(deadline)}</Text>
          </TouchableOpacity>

          {/* Giới hạn thời gian + Điểm đạt */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-600 mb-1">
                {t("quiz.time_limit_label", { defaultValue: "Thời gian (phút, 0 = không giới hạn)" })}
              </Text>
              <TextInput
                value={timeLimitMinutes}
                onChangeText={setTimeLimitMinutes}
                keyboardType="numeric"
                className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-slate-600 mb-1">
                {t("quiz.pass_score_label", { defaultValue: `Điểm đạt (tối đa ${totalPoints})` })}
              </Text>
              <TextInput
                value={passScore}
                onChangeText={setPassScore}
                keyboardType="numeric"
                className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5"
              />
            </View>
          </View>
        </View>

        {/* ─── Danh sách câu hỏi ─── */}
        <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
          {t("quiz.questions_section", { defaultValue: "Câu hỏi" })}
        </Text>

        {questions.map((q, idx) => (
          <QuizQuestionCard
            key={q._id}
            question={q}
            index={idx}
            onUpdate={(updated: QuizQuestion) => handleUpdateQuestion(idx, updated)}
            onDelete={() => handleDeleteQuestion(idx)}
          />
        ))}

        {/* ─── Thêm câu hỏi ─── */}
        <View className="relative mb-4">
          <TouchableOpacity
            onPress={() => setShowAddMenu((v) => !v)}
            className="flex-row items-center justify-center gap-2 bg-white border border-dashed border-blue-300 rounded-2xl py-3.5"
          >
            <Feather name="plus" size={16} color="#0052FF" />
            <Text className="text-sm font-bold text-[#0052FF]">
              {t("quiz.add_question_btn", { defaultValue: "Thêm câu hỏi" })}
            </Text>
          </TouchableOpacity>

          {showAddMenu && (
            <View
              className="absolute left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden z-50"
              style={{ top: 52 }}
            >
              <TouchableOpacity
                onPress={() => handleAddQuestion("choice")}
                className="flex-row items-center gap-3 px-4 py-3.5 active:bg-slate-50"
              >
                <Feather name="check-square" size={16} color="#0052FF" />
                <Text className="text-sm font-medium text-slate-800">
                  {t("quiz.add_choice_question", { defaultValue: "Câu trắc nghiệm (lựa chọn)" })}
                </Text>
              </TouchableOpacity>
              <View className="h-px bg-slate-100 mx-4" />
              <TouchableOpacity
                onPress={() => handleAddQuestion("text")}
                className="flex-row items-center gap-3 px-4 py-3.5 active:bg-slate-50"
              >
                <Feather name="edit-3" size={16} color="#7C3AED" />
                <Text className="text-sm font-medium text-slate-800">
                  {t("quiz.add_text_question", { defaultValue: "Câu tự luận (văn bản)" })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Footer actions ─── */}
      <View className="bg-white border-t border-slate-100 px-4 py-3 flex-row gap-3">
        <TouchableOpacity
          onPress={() => handleSubmit("draft")}
          disabled={isSubmitting}
          className="flex-1 border border-slate-200 bg-slate-50 active:bg-slate-100 rounded-2xl py-3 items-center"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#64748B" />
          ) : (
            <Text className="text-sm font-bold text-slate-700">
              {t("assignments.save_draft_btn", { defaultValue: "Lưu nháp" })}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSubmit("published")}
          disabled={isSubmitting}
          className="flex-[2] bg-purple-600 active:bg-purple-700 rounded-2xl py-3 items-center"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-sm font-bold text-white">
              {assignmentToEdit
                ? t("quiz.save_changes_btn", { defaultValue: "Lưu thay đổi" })
                : t("quiz.publish_btn", { defaultValue: "Xuất bản trắc nghiệm" })}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* DateTimePicker đơn giản — deadline */}
      {showDatePicker && (
        <View
          className="absolute inset-0 bg-black/40 items-center justify-center"
          style={{ zIndex: 100 }}
        >
          <View className="bg-white rounded-2xl p-4 mx-6 w-full max-w-sm">
            <Text className="font-bold text-slate-800 text-base mb-3 text-center">
              {t("assignments.select_deadline", { defaultValue: "Chọn hạn chót" })}
            </Text>
            <TextInput
              value={deadline.toISOString().slice(0, 16)}
              onChangeText={(v) => {
                const d = new Date(v);
                if (!isNaN(d.getTime())) setDeadline(d);
              }}
              placeholder="YYYY-MM-DDTHH:MM"
              className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 mb-3 font-mono"
            />
            <TouchableOpacity
              onPress={() => setShowDatePicker(false)}
              className="bg-[#0052FF] rounded-xl py-2.5 items-center"
            >
              <Text className="font-bold text-white text-sm">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal thiết đặt */}
      <QuizSettingsModal
        visible={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onSave={(updated: QuizSettings) => setSettings(updated)}
      />
    </View>
  );
}
