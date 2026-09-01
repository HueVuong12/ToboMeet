import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCreateSignedUploadUrlMutation } from "../../lib/redux/api/channelFilesApi";
import { Assignment, Attachment } from "./types";

interface AssignmentCreateProps {
  roomId: string;
  channels: any[];
  roomMembers: any[];
  userId: string;
  assignmentToEdit?: Assignment;
  onBack: () => void;
  onSubmit: (payload: any) => Promise<void>;
  isSubmitting?: boolean;
}

export default function AssignmentCreate({
  roomId,
  channels = [],
  roomMembers = [],
  userId,
  assignmentToEdit,
  onBack,
  onSubmit,
  isSubmitting = false,
}: AssignmentCreateProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState(assignmentToEdit?.title || "");
  const [description, setDescription] = useState(assignmentToEdit?.description || "");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(
    assignmentToEdit?.channelIds || (assignmentToEdit?.channelId ? [assignmentToEdit.channelId] : [channels[0]?._id || ""])
  );
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);

  // Deadline state
  const defaultDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [deadlineDate, setDeadlineDate] = useState<string>(
    assignmentToEdit?.deadline ? assignmentToEdit.deadline.split("T")[0] : defaultDeadline.toISOString().split("T")[0]
  );
  const [deadlineTime, setDeadlineTime] = useState<string>(
    assignmentToEdit?.deadline ? assignmentToEdit.deadline.split("T")[1]?.slice(0, 5) || "23:59" : "23:59"
  );

  // Date & Time Picker Modal States
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);

  // Calendar State
  const initialCalendarDate = deadlineDate ? new Date(deadlineDate) : new Date();
  const [calYear, setCalYear] = useState<number>(initialCalendarDate.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(initialCalendarDate.getMonth()); // 0-11

  // Time Picker State
  const [selectedHour, setSelectedHour] = useState<string>(deadlineTime ? deadlineTime.split(":")[0] || "23" : "23");
  const [selectedMinute, setSelectedMinute] = useState<string>(deadlineTime ? deadlineTime.split(":")[1] || "59" : "59");

  const [submissionPolicy, setSubmissionPolicy] = useState<"allow_late" | "lock_after_deadline">(
    assignmentToEdit?.submissionPolicy || "allow_late"
  );
  const [showPolicyDropdown, setShowPolicyDropdown] = useState(false);

  const [recipientType, setRecipientType] = useState<"all_current_and_future" | "current_members" | "specific_members">(
    assignmentToEdit?.recipientType || "all_current_and_future"
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    assignmentToEdit?.recipientMemberIds || []
  );

  // Search state for member list
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  // ComboBox dropdown toggle (inline)
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  const [gradingType, setGradingType] = useState<"graded" | "ungraded">(
    assignmentToEdit?.gradingType || "graded"
  );
  const [maxScore, setMaxScore] = useState<string>(
    assignmentToEdit?.maxScore !== undefined ? String(assignmentToEdit.maxScore) : "10"
  );

  const [attachments, setAttachments] = useState<Attachment[]>(
    assignmentToEdit?.attachments || []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [createSignedUploadUrl] = useCreateSignedUploadUrlMutation();

  const formatDisplayDate = (isoDateStr: string) => {
    if (!isoDateStr) return t("assignments.field_deadline_date");
    const parts = isoDateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDateStr;
  };

  const getSelectedChannelsLabel = () => {
    if (selectedChannelIds.length === 0) return t("assignments.field_channel_placeholder");
    const selectedNames = selectedChannelIds
      .map((id) => channels.find((c) => c._id === id)?.name)
      .filter(Boolean);

    if (selectedNames.length <= 2) {
      return selectedNames.map((name) => `#${name}`).join(", ");
    }
    return `${selectedNames.slice(0, 2).map((name) => `#${name}`).join(", ")} +${selectedNames.length - 2}`;
  };

  const handleToggleChannel = (cId: string) => {
    if (selectedChannelIds.includes(cId)) {
      if (selectedChannelIds.length === 1) {
        Alert.alert(t("room.notice"), t("assignments.error_channel_required"));
        return;
      }
      setSelectedChannelIds((prev) => prev.filter((id) => id !== cId));
    } else {
      setSelectedChannelIds((prev) => [...prev, cId]);
    }
  };

  const handleToggleMember = (mId: string) => {
    if (selectedMemberIds.includes(mId)) {
      setSelectedMemberIds((prev) => prev.filter((id) => id !== mId));
    } else {
      setSelectedMemberIds((prev) => [...prev, mId]);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      setIsUploading(true);

      for (const asset of result.assets) {
        const res = await createSignedUploadUrl({
          roomId,
          channelId: selectedChannelIds[0] || "general",
          fileName: asset.name,
        }).unwrap();

        const uploadResult = await FileSystem.uploadAsync(res.signedUrl, asset.uri, {
          httpMethod: "PUT",
          headers: { "Content-Type": asset.mimeType || "application/octet-stream" },
        });

        if (uploadResult.status === 200) {
          setAttachments((prev) => [
            ...prev,
            {
              name: asset.name,
              url: res.publicUrl,
              size: asset.size || 0,
              type: asset.mimeType || "application/octet-stream",
              uploadedAt: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.message || t("assignments.toast_error_generic"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (status: "draft" | "published") => {
    if (status === "published") {
      if (!title.trim()) {
        Alert.alert(t("room.notice"), t("assignments.error_title_required"));
        return;
      }
      if (!deadlineDate || !deadlineTime) {
        Alert.alert(t("room.notice"), t("assignments.error_deadline_required"));
        return;
      }

      const fullDeadline = new Date(`${deadlineDate}T${deadlineTime}:00`);
      if (isNaN(fullDeadline.getTime())) {
        Alert.alert(t("room.notice"), t("assignments.error_deadline_required"));
        return;
      }

      if (fullDeadline.getTime() < Date.now()) {
        Alert.alert(t("room.notice"), t("assignments.error_deadline_required"));
        return;
      }

      if (gradingType === "graded") {
        const score = parseFloat(maxScore);
        if (isNaN(score) || score <= 0) {
          Alert.alert(t("room.notice"), t("assignments.error_score_invalid", { maxScore: 10 }));
          return;
        }
      }
    }

    const fullDeadlineIso = new Date(`${deadlineDate}T${deadlineTime}:00`).toISOString();

    const payload: any = {
      title: title.trim(),
      description: description.trim(),
      roomId,
      channelId: selectedChannelIds[0] || "",
      channelIds: selectedChannelIds,
      deadline: fullDeadlineIso,
      submissionPolicy,
      recipientType,
      recipientMemberIds: recipientType === "specific_members" ? selectedMemberIds : [],
      gradingType,
      maxScore: gradingType === "graded" ? parseFloat(maxScore) || 10 : undefined,
      attachments,
      status,
    };

    await onSubmit(payload);
  };

  const getRecipientLabel = (type: typeof recipientType) => {
    switch (type) {
      case "all_current_and_future":
        return t("assignments.recipient_current_and_future");
      case "current_members":
        return t("assignments.recipient_current");
      case "specific_members":
        return t("assignments.recipient_specific");
      default:
        return t("assignments.recipient_current_and_future");
    }
  };

  const filteredMembers = roomMembers.filter((m) => {
    const isNotSelf = m.userId !== userId && m.supabaseId !== userId;
    if (!isNotSelf) return false;
    if (!memberSearchQuery.trim()) return true;
    const name = m.displayName || m.name || m.email || "";
    return name.toLowerCase().includes(memberSearchQuery.toLowerCase().trim());
  });

  // Calendar Helpers
  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun, 1 = Mon...
  const todayStr = new Date().toISOString().split("T")[0];

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const monthStr = String(calMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const selectedDateStr = `${calYear}-${monthStr}-${dayStr}`;

    if (selectedDateStr < todayStr) {
      Alert.alert(t("room.notice"), t("assignments.error_deadline_required"));
      return;
    }

    setDeadlineDate(selectedDateStr);
    setShowDatePickerModal(false);
  };

  const handleConfirmTime = () => {
    setDeadlineTime(`${selectedHour}:${selectedMinute}`);
    setShowTimePickerModal(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View className="flex-1 bg-slate-50">
        {/* Top Header */}
        <View className="flex-row items-center justify-between px-4 py-3.5 bg-white border-b border-slate-100">
          <TouchableOpacity onPress={onBack} className="flex-row items-center gap-2">
            <Feather name="arrow-left" size={20} color="#475569" />
            <Text className="font-bold text-slate-800 text-base">
              {assignmentToEdit ? t("assignments.edit_title") : t("assignments.create_title")}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
        {/* SINGLE UNIFIED CARD CONTAINER FOR ALL FORM FIELDS */}
        <View className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs mb-4">
          {/* 1. Tiêu đề nhiệm vụ */}
          <Text className="font-bold text-slate-700 text-xs mb-1.5">
            {t("assignments.field_title_required")}
          </Text>
          <TextInput
            placeholder={t("assignments.field_title_placeholder")}
            value={title}
            onChangeText={setTitle}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold mb-4"
          />

          {/* 2. Mô tả nhiệm vụ */}
          <Text className="font-bold text-slate-700 text-xs mb-1.5">
            {t("assignments.field_desc")}
          </Text>
          <TextInput
            placeholder={t("assignments.field_desc_placeholder")}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 h-28 mb-5"
            textAlignVertical="top"
          />

          {/* 3. File đính kèm */}
          <Text className="font-bold text-slate-800 text-sm mb-2.5">
            {t("assignments.attachments_title", { count: attachments.length })}
          </Text>
          <TouchableOpacity
            onPress={handlePickDocument}
            disabled={isUploading}
            activeOpacity={0.7}
            className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-5 items-center justify-center min-h-[130px] mb-3 active:bg-slate-100"
          >
            {isUploading ? (
              <View className="items-center justify-center gap-2 py-2">
                <ActivityIndicator size="small" color="#0052FF" />
                <Text className="text-xs font-semibold text-slate-500">{t("assignments.uploading_files")}</Text>
              </View>
            ) : (
              <View className="items-center justify-center gap-2">
                <View className="w-10 h-10 rounded-full bg-blue-50 justify-center items-center">
                  <Feather name="upload" size={20} color="#0052FF" />
                </View>
                <Text className="text-xs font-bold text-slate-700 text-center">
                  {t("assignments.pick_doc_btn")}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {attachments.length > 0 && (
            <View className="mb-5">
              {attachments.map((att, idx) => (
                <View
                  key={idx}
                  className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2"
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <Feather name="file-text" size={16} color="#0052FF" />
                    <Text className="font-semibold text-slate-700 text-xs ml-2.5 flex-1" numberOfLines={1}>
                      {att.name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-lg bg-red-50 active:bg-red-100"
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* 4. Thời gian */}
          <Text className="font-bold text-slate-800 text-sm mb-3">
            {t("assignments.section_time")}
          </Text>

          <View className="flex-row gap-3 mb-5">
            {/* Ngày hết hạn */}
            <TouchableOpacity
              onPress={() => setShowDatePickerModal(true)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 flex-row items-center justify-between active:bg-slate-100"
            >
              <View className="flex-1 mr-1">
                <Text className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                  {t("assignments.field_deadline_date")}
                </Text>
                <Text className="text-xs font-bold text-slate-800">
                  {formatDisplayDate(deadlineDate)}
                </Text>
              </View>
              <Feather name="calendar" size={18} color="#0052FF" />
            </TouchableOpacity>

            {/* Giờ hết hạn */}
            <TouchableOpacity
              onPress={() => setShowTimePickerModal(true)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 flex-row items-center justify-between active:bg-slate-100"
            >
              <View className="flex-1 mr-1">
                <Text className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                  {t("assignments.field_deadline_time")}
                </Text>
                <Text className="text-xs font-bold text-slate-800">
                  {deadlineTime}
                </Text>
              </View>
              <Feather name="clock" size={18} color="#0052FF" />
            </TouchableOpacity>
          </View>

          {/* 5. Kênh nhận nhiệm vụ */}
          <Text className="font-bold text-slate-800 text-sm mb-2">{t("assignments.field_channel")}</Text>
          <TouchableOpacity
            onPress={() => setShowChannelDropdown((prev) => !prev)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-slate-100 mb-5"
          >
            <Text className="font-bold text-slate-800 text-sm flex-1 mr-2" numberOfLines={1}>
              {getSelectedChannelsLabel()}
            </Text>
            <Feather name={showChannelDropdown ? "chevron-up" : "chevron-down"} size={18} color="#64748B" />
          </TouchableOpacity>

          {showChannelDropdown && (
            <View className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-1.5 gap-1">
              {channels.map((channel) => {
                const isSelected = selectedChannelIds.includes(channel._id);
                return (
                  <TouchableOpacity
                    key={channel._id}
                    onPress={() => handleToggleChannel(channel._id)}
                    className={`p-3 rounded-lg flex-row items-center justify-between ${
                      isSelected ? "bg-blue-50 border border-blue-200" : "bg-white"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      #{channel.name}
                    </Text>
                    <Feather
                      name={isSelected ? "check-square" : "square"}
                      size={18}
                      color={isSelected ? "#0052FF" : "#94A3B8"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 6. Giao cho */}
          <Text className="font-bold text-slate-800 text-sm mb-2">{t("assignments.field_recipient")}</Text>
          <TouchableOpacity
            onPress={() => setShowRecipientDropdown((prev) => !prev)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-slate-100 mb-5"
          >
            <Text className="font-bold text-slate-800 text-sm">
              {getRecipientLabel(recipientType)}
            </Text>
            <Feather name={showRecipientDropdown ? "chevron-up" : "chevron-down"} size={18} color="#64748B" />
          </TouchableOpacity>

          {showRecipientDropdown && (
            <View className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-1.5 gap-1">
              <TouchableOpacity
                onPress={() => {
                  setRecipientType("all_current_and_future");
                  setShowRecipientDropdown(false);
                }}
                className={`p-3 rounded-lg flex-row items-center justify-between ${
                  recipientType === "all_current_and_future" ? "bg-blue-50 border border-blue-200" : "bg-white"
                }`}
              >
                <Text className="font-bold text-xs text-slate-800">{t("assignments.recipient_current_and_future")}</Text>
                {recipientType === "all_current_and_future" && <Feather name="check" size={16} color="#0052FF" />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setRecipientType("current_members");
                  setShowRecipientDropdown(false);
                }}
                className={`p-3 rounded-lg flex-row items-center justify-between ${
                  recipientType === "current_members" ? "bg-blue-50 border border-blue-200" : "bg-white"
                }`}
              >
                <Text className="font-bold text-xs text-slate-800">{t("assignments.recipient_current")}</Text>
                {recipientType === "current_members" && <Feather name="check" size={16} color="#0052FF" />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setRecipientType("specific_members");
                  setShowRecipientDropdown(false);
                }}
                className={`p-3 rounded-lg flex-row items-center justify-between ${
                  recipientType === "specific_members" ? "bg-blue-50 border border-blue-200" : "bg-white"
                }`}
              >
                <Text className="font-bold text-xs text-slate-800">{t("assignments.recipient_specific")}</Text>
                {recipientType === "specific_members" && <Feather name="check" size={16} color="#0052FF" />}
              </TouchableOpacity>
            </View>
          )}

          {/* Specific Member List */}
          {recipientType === "specific_members" && (
            <View className="mb-5 pt-3 border-t border-slate-100">
              <View className="bg-slate-50 border border-slate-200 rounded-xl flex-row items-center px-3 py-2 mb-3">
                <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                <TextInput
                  value={memberSearchQuery}
                  onChangeText={setMemberSearchQuery}
                  placeholder={t("assignments.search_members")}
                  placeholderTextColor="#94A3B8"
                  className="flex-1 text-xs text-slate-900 py-0.5 font-medium"
                />
                {memberSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMemberSearchQuery("")}>
                    <Feather name="x" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              <Text className="font-bold text-slate-700 text-xs mb-2">
                {t("assignments.select_members")} ({selectedMemberIds.length})
              </Text>

              {filteredMembers.length === 0 ? (
                <Text className="text-xs text-slate-400 py-2">{t("assignments.no_data")}</Text>
              ) : (
                filteredMembers.map((m) => {
                  const mId = m.userId || m.supabaseId;
                  const isChecked = selectedMemberIds.includes(mId);
                  return (
                    <TouchableOpacity
                      key={mId}
                      onPress={() => handleToggleMember(mId)}
                      className="flex-row items-center justify-between py-2.5 border-b border-slate-50 active:bg-slate-50 px-1"
                    >
                      <Text className="text-xs font-semibold text-slate-800">
                        {m.displayName || m.name || m.email || t("room.member")}
                      </Text>
                      <Feather
                        name={isChecked ? "check-square" : "square"}
                        size={18}
                        color={isChecked ? "#0052FF" : "#94A3B8"}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* 7. Hình thức đánh giá */}
          <Text className="font-bold text-slate-800 text-sm mb-3">{t("assignments.section_grading")}</Text>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              onPress={() => setGradingType("graded")}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                gradingType === "graded"
                  ? "bg-blue-50 border-blue-300"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <Text
                className={`font-bold text-xs ${
                  gradingType === "graded" ? "text-blue-700" : "text-slate-600"
                }`}
              >
                {t("assignments.grading_graded")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setGradingType("ungraded")}
              className={`flex-1 py-2.5 rounded-xl border items-center ${
                gradingType === "ungraded"
                  ? "bg-blue-50 border-blue-300"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <Text
                className={`font-bold text-xs ${
                  gradingType === "ungraded" ? "text-blue-700" : "text-slate-600"
                }`}
              >
                {t("assignments.grading_ungraded")}
              </Text>
            </TouchableOpacity>
          </View>

          {gradingType === "graded" && (
            <View className="mb-5">
              <Text className="text-xs font-semibold text-slate-500 mb-1">{t("assignments.field_max_score")}</Text>
              <TextInput
                value={maxScore}
                onChangeText={setMaxScore}
                keyboardType="numeric"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold"
              />
            </View>
          )}

          {/* 8. Chính sách nhiệm vụ */}
          <Text className="font-bold text-slate-800 text-sm mb-2">{t("assignments.field_policy")}</Text>
          <TouchableOpacity
            onPress={() => setShowPolicyDropdown((prev) => !prev)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-slate-100"
          >
            <Text className="font-bold text-slate-800 text-sm">
              {submissionPolicy === "lock_after_deadline"
                ? t("assignments.policy_lock")
                : t("assignments.policy_allow")}
            </Text>
            <Feather name={showPolicyDropdown ? "chevron-up" : "chevron-down"} size={18} color="#64748B" />
          </TouchableOpacity>

          {showPolicyDropdown && (
            <View className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 gap-1">
              <TouchableOpacity
                onPress={() => {
                  setSubmissionPolicy("allow_late");
                  setShowPolicyDropdown(false);
                }}
                className={`p-3 rounded-lg flex-row items-center justify-between ${
                  submissionPolicy === "allow_late" ? "bg-blue-50 border border-blue-200" : "bg-white"
                }`}
              >
                <Text className="font-bold text-xs text-slate-800">{t("assignments.policy_allow")}</Text>
                {submissionPolicy === "allow_late" && <Feather name="check" size={16} color="#0052FF" />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSubmissionPolicy("lock_after_deadline");
                  setShowPolicyDropdown(false);
                }}
                className={`p-3 rounded-lg flex-row items-center justify-between ${
                  submissionPolicy === "lock_after_deadline" ? "bg-blue-50 border border-blue-200" : "bg-white"
                }`}
              >
                <Text className="font-bold text-xs text-slate-800">{t("assignments.policy_lock")}</Text>
                {submissionPolicy === "lock_after_deadline" && <Feather name="check" size={16} color="#0052FF" />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal (Calendar Selector) */}
      <Modal
        visible={showDatePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDatePickerModal(false)}
          className="flex-1 bg-black/50 justify-center items-center px-4"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100"
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-bold text-slate-900 text-base">{t("assignments.field_deadline_date")}</Text>
              <TouchableOpacity onPress={() => setShowDatePickerModal(false)} className="p-1">
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigator */}
            <View className="flex-row items-center justify-between mb-4 bg-slate-50 rounded-xl p-2">
              <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                <Feather name="chevron-left" size={20} color="#0052FF" />
              </TouchableOpacity>
              <Text className="font-bold text-slate-800 text-sm">
                {monthNames[calMonth]} - {calYear}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} className="p-2">
                <Feather name="chevron-right" size={20} color="#0052FF" />
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View className="flex-row justify-around mb-2">
              {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d, i) => (
                <Text key={i} className="text-xs font-bold text-slate-400 w-9 text-center">
                  {d}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View className="flex-row flex-wrap">
              {/* Empty offset slots */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <View key={`empty-${idx}`} className="w-[14.28%] h-10" />
              ))}

              {/* Days in month */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const monthStr = String(calMonth + 1).padStart(2, "0");
                const dayStr = String(dayNum).padStart(2, "0");
                const cellDateStr = `${calYear}-${monthStr}-${dayStr}`;
                const isSelected = deadlineDate === cellDateStr;
                const isPast = cellDateStr < todayStr;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    disabled={isPast}
                    onPress={() => handleSelectDay(dayNum)}
                    className={`w-[14.28%] h-10 items-center justify-center rounded-xl my-0.5 ${
                      isSelected
                        ? "bg-[#0052FF]"
                        : isPast
                        ? "opacity-25"
                        : "active:bg-slate-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        isSelected
                          ? "text-white"
                          : isPast
                          ? "text-slate-400"
                          : "text-slate-800"
                      }`}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowTimePickerModal(false)}
          className="flex-1 bg-black/50 justify-center items-center px-4"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100"
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-bold text-slate-900 text-base">{t("assignments.field_deadline_time")}</Text>
              <TouchableOpacity onPress={() => setShowTimePickerModal(false)} className="p-1">
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Time Pickers (Hours & Minutes) */}
            <View className="flex-row gap-4 mb-5">
              {/* Hours Grid */}
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-500 mb-2 text-center">{t("calendar.hour")} (00 - 23)</Text>
                <ScrollView className="h-44 bg-slate-50 border border-slate-200 rounded-xl p-1">
                  {Array.from({ length: 24 }).map((_, h) => {
                    const hStr = String(h).padStart(2, "0");
                    const isSel = selectedHour === hStr;
                    return (
                      <TouchableOpacity
                        key={hStr}
                        onPress={() => setSelectedHour(hStr)}
                        className={`py-2 rounded-lg items-center mb-1 ${
                          isSel ? "bg-[#0052FF]" : "active:bg-slate-200"
                        }`}
                      >
                        <Text className={`text-xs font-bold ${isSel ? "text-white" : "text-slate-800"}`}>
                          {hStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Minutes Grid */}
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-500 mb-2 text-center">{t("calendar.minute")} (00 - 59)</Text>
                <ScrollView className="h-44 bg-slate-50 border border-slate-200 rounded-xl p-1">
                  {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55", "59"].map((mStr) => {
                    const isSel = selectedMinute === mStr;
                    return (
                      <TouchableOpacity
                        key={mStr}
                        onPress={() => setSelectedMinute(mStr)}
                        className={`py-2 rounded-lg items-center mb-1 ${
                          isSel ? "bg-[#0052FF]" : "active:bg-slate-200"
                        }`}
                      >
                        <Text className={`text-xs font-bold ${isSel ? "text-white" : "text-slate-800"}`}>
                          {mStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              onPress={handleConfirmTime}
              className="bg-[#0052FF] py-3 rounded-xl items-center shadow-xs"
            >
              <Text className="font-bold text-white text-sm">{t("calendar.confirm")}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sticky Bottom Action Buttons Footer */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        className="bg-white border-t border-slate-200 px-4 pt-3 shadow-lg"
      >
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => handleSave("draft")}
            disabled={isSubmitting || isUploading}
            className="flex-1 h-12 rounded-xl bg-slate-100 active:bg-slate-200 items-center justify-center border border-slate-200"
          >
            <Text className="font-bold text-slate-800 text-sm text-center">{t("assignments.save_draft_btn")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSave("published")}
            disabled={isSubmitting || isUploading}
            className="flex-1 h-12 rounded-xl bg-[#0052FF] active:bg-blue-700 items-center justify-center flex-row gap-1.5 shadow-xs"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="send" size={16} color="#ffffff" />
            )}
            <Text className="font-bold text-white text-sm text-center">{t("assignments.publish_btn")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </KeyboardAvoidingView>
);
}
