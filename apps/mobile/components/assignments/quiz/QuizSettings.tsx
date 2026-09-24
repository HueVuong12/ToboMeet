import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { QuizSettings } from "../types";

interface QuizSettingsProps {
  visible: boolean;
  settings: QuizSettings;
  onClose: () => void;
  onSave: (updated: QuizSettings) => void;
}

type DateField = "startDate" | "endDate" | "closeDate";

export default function QuizSettingsModal({
  visible,
  settings,
  onClose,
  onSave,
}: QuizSettingsProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<QuizSettings>(settings);

  // Sub-modal for selecting date & time
  const [activePickerField, setActivePickerField] = useState<DateField | null>(null);
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [selectedHour, setSelectedHour] = useState<string>("12");
  const [selectedMinute, setSelectedMinute] = useState<string>("00");

  const isVietnamese = i18n.language?.startsWith("vi");

  const updateField = <K extends keyof QuizSettings>(key: K, value: QuizSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const openPicker = (field: DateField) => {
    const currentVal = draft[field] ? new Date(draft[field] as string) : new Date();
    setCalYear(currentVal.getFullYear());
    setCalMonth(currentVal.getMonth());
    setSelectedDay(currentVal.getDate());
    setSelectedHour(String(currentVal.getHours()).padStart(2, "0"));
    setSelectedMinute(String(currentVal.getMinutes()).padStart(2, "0"));
    setActivePickerField(field);
  };

  const handleConfirmDateTime = () => {
    if (!activePickerField) return;
    const d = new Date(calYear, calMonth, selectedDay, parseInt(selectedHour, 10), parseInt(selectedMinute, 10));
    setDraft((prev) => ({ ...prev, [activePickerField]: d.toISOString() }));
    setActivePickerField(null);
  };

  const formatDate = (iso?: string | null): string => {
    if (!iso) return t("quiz.not_set", { defaultValue: "Chưa đặt" });
    const d = new Date(iso);
    if (isNaN(d.getTime())) return t("quiz.not_set", { defaultValue: "Chưa đặt" });
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const toggleDateField = (field: DateField, enabled: boolean) => {
    if (enabled) {
      const now = new Date();
      setDraft((prev) => ({ ...prev, [field]: now.toISOString() }));
      openPicker(field);
    } else {
      setDraft((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  // Calendar calculations
  const monthNames = isVietnamese
    ? [
        "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
      ]
    : [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
  const dayHeaders = isVietnamese
    ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/50 justify-end"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="bg-white rounded-t-3xl"
          style={{ maxHeight: "88%" }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
            <Text className="text-base font-bold text-slate-900">
              {t("quiz.settings_title", { defaultValue: "Thiết đặt bài kiểm tra" })}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Tùy chọn kết quả */}
            <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
              {t("quiz.settings_results_section", { defaultValue: "Tùy chọn kết quả" })}
            </Text>

            <View className="bg-slate-50 rounded-2xl border border-slate-100 mb-5 overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-3.5">
                <View className="flex-1 mr-4">
                  <Text className="text-sm font-semibold text-slate-800">
                    {t("quiz.show_results_after_submit", { defaultValue: "Hiển thị kết quả tự động" })}
                  </Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {t("quiz.show_results_hint", {
                      defaultValue: "Thành viên thấy đáp án đúng sau khi bài kiểm tra đóng",
                    })}
                  </Text>
                </View>
                <Switch
                  value={draft.showResultsAfterSubmit}
                  onValueChange={(v) => updateField("showResultsAfterSubmit", v)}
                  trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                  thumbColor={draft.showResultsAfterSubmit ? "#0052FF" : "#94A3B8"}
                />
              </View>

              <View className="h-px bg-slate-100 mx-4" />

              <View className="flex-row items-center justify-between px-4 py-3.5">
                <View className="flex-1 mr-4">
                  <Text className="text-sm font-semibold text-slate-800">
                    {t("quiz.shuffle_questions", { defaultValue: "Sắp xếp ngẫu nhiên câu hỏi" })}
                  </Text>
                </View>
                <Switch
                  value={draft.shuffleQuestions}
                  onValueChange={(v) => updateField("shuffleQuestions", v)}
                  trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                  thumbColor={draft.shuffleQuestions ? "#0052FF" : "#94A3B8"}
                />
              </View>
            </View>

            {/* Quyền truy cập */}
            <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
              {t("quiz.settings_access_section", { defaultValue: "Ai có thể làm bài" })}
            </Text>

            <View className="bg-slate-50 rounded-2xl border border-slate-100 mb-5 overflow-hidden">
              {(["organization", "anyone", "specific_members"] as const).map((opt, i, arr) => (
                <React.Fragment key={opt}>
                  <TouchableOpacity
                    onPress={() => updateField("accessControl", opt)}
                    className="flex-row items-center justify-between px-4 py-3.5"
                  >
                    <Text className="text-sm font-medium text-slate-800">
                      {opt === "organization"
                        ? t("quiz.access_org", { defaultValue: "Chỉ người trong tổ chức" })
                        : opt === "anyone"
                        ? t("quiz.access_anyone", { defaultValue: "Bất kỳ ai" })
                        : t("quiz.access_specific", { defaultValue: "Người cụ thể" })}
                    </Text>
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                        draft.accessControl === opt
                          ? "border-[#0052FF] bg-[#0052FF]"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {draft.accessControl === opt && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View className="h-px bg-slate-100 mx-4" />}
                </React.Fragment>
              ))}
            </View>

            {/* Tùy chọn phản hồi */}
            <Text className="text-xs font-bold text-slate-400 uppercase mb-3">
              {t("quiz.settings_response_section", { defaultValue: "Tùy chọn phản hồi" })}
            </Text>

            <View className="bg-slate-50 rounded-2xl border border-slate-100 mb-5 overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-3.5">
                <Text className="text-sm font-semibold text-slate-800">
                  {t("quiz.accepting_responses", { defaultValue: "Chấp nhận phản hồi" })}
                </Text>
                <Switch
                  value={draft.acceptingResponses}
                  onValueChange={(v) => updateField("acceptingResponses", v)}
                  trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                  thumbColor={draft.acceptingResponses ? "#0052FF" : "#94A3B8"}
                />
              </View>

              <View className="h-px bg-slate-100 mx-4" />

              <DateRowItem
                label={t("quiz.start_date_label", { defaultValue: "Ngày bắt đầu" })}
                value={formatDate(draft.startDate)}
                enabled={!!draft.startDate}
                onToggle={(v) => toggleDateField("startDate", v)}
                onPressDate={() => openPicker("startDate")}
              />

              <View className="h-px bg-slate-100 mx-4" />

              <DateRowItem
                label={t("quiz.end_date_label", { defaultValue: "Ngày kết thúc" })}
                value={formatDate(draft.endDate)}
                enabled={!!draft.endDate}
                onToggle={(v) => toggleDateField("endDate", v)}
                onPressDate={() => openPicker("endDate")}
              />

              <View className="h-px bg-slate-100 mx-4" />

              <DateRowItem
                label={t("quiz.close_date_label", { defaultValue: "Thời gian đóng" })}
                value={formatDate(draft.closeDate)}
                enabled={!!draft.closeDate}
                onToggle={(v) => toggleDateField("closeDate", v)}
                onPressDate={() => openPicker("closeDate")}
              />
            </View>
          </ScrollView>

          {/* Save button */}
          <View className="px-5 pb-6 pt-2 border-t border-slate-100">
            <TouchableOpacity
              onPress={handleSave}
              className="bg-[#0052FF] active:bg-blue-700 rounded-2xl py-3.5 items-center"
            >
              <Text className="font-bold text-white text-sm">
                {t("quiz.save_settings", { defaultValue: "Lưu thiết đặt" })}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Date & Time Picker Modal */}
      {activePickerField && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePickerField(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setActivePickerField(null)}
            className="flex-1 bg-black/60 justify-center items-center px-4"
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-bold text-slate-900 text-base">
                  {activePickerField === "startDate"
                    ? t("quiz.start_date_label", { defaultValue: "Ngày bắt đầu" })
                    : activePickerField === "endDate"
                    ? t("quiz.end_date_label", { defaultValue: "Ngày kết thúc" })
                    : t("quiz.close_date_label", { defaultValue: "Thời gian đóng" })}
                </Text>
                <TouchableOpacity onPress={() => setActivePickerField(null)} className="p-1">
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Month Navigation */}
              <View className="flex-row items-center justify-between mb-3 px-1">
                <TouchableOpacity onPress={handlePrevMonth} className="p-2 bg-slate-100 rounded-full">
                  <Feather name="chevron-left" size={16} color="#334155" />
                </TouchableOpacity>
                <Text className="font-bold text-slate-800 text-sm">
                  {monthNames[calMonth]} {calYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} className="p-2 bg-slate-100 rounded-full">
                  <Feather name="chevron-right" size={16} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Day Headers */}
              <View className="flex-row mb-1">
                {dayHeaders.map((dh) => (
                  <View key={dh} className="w-[14.28%] items-center py-1">
                    <Text className="text-[11px] font-bold text-slate-400">{dh}</Text>
                  </View>
                ))}
              </View>

              {/* Day Grid */}
              <View className="flex-row flex-wrap mb-4">
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <View key={`empty-${idx}`} className="w-[14.28%] h-8" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const isSelected = selectedDay === dayNum;
                  return (
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      onPress={() => setSelectedDay(dayNum)}
                      className={`w-[14.28%] h-8 items-center justify-center rounded-xl my-0.5 ${
                        isSelected ? "bg-[#0052FF]" : "active:bg-slate-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? "text-white" : "text-slate-800"
                        }`}
                      >
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time Selector */}
              <View className="flex-row items-center justify-between bg-slate-50 p-3 rounded-2xl mb-4">
                <View className="flex-row items-center gap-2">
                  <Feather name="clock" size={16} color="#0052FF" />
                  <Text className="text-xs font-bold text-slate-700">
                    {t("calendar.time", { defaultValue: "Giờ:Phút" })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  {/* Hour scroll/picker */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-w-[100px]">
                    <View className="flex-row gap-1">
                      {Array.from({ length: 24 }).map((_, h) => {
                        const hStr = String(h).padStart(2, "0");
                        const active = selectedHour === hStr;
                        return (
                          <TouchableOpacity
                            key={`h-${hStr}`}
                            onPress={() => setSelectedHour(hStr)}
                            className={`px-2 py-1 rounded-lg ${active ? "bg-[#0052FF]" : "bg-white border border-slate-200"}`}
                          >
                            <Text className={`text-xs font-bold ${active ? "text-white" : "text-slate-700"}`}>
                              {hStr}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <Text className="text-sm font-bold text-slate-400">:</Text>
                  {/* Minute */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-w-[100px]">
                    <View className="flex-row gap-1">
                      {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((mStr) => {
                        const active = selectedMinute === mStr;
                        return (
                          <TouchableOpacity
                            key={`m-${mStr}`}
                            onPress={() => setSelectedMinute(mStr)}
                            className={`px-2 py-1 rounded-lg ${active ? "bg-[#0052FF]" : "bg-white border border-slate-200"}`}
                          >
                            <Text className={`text-xs font-bold ${active ? "text-white" : "text-slate-700"}`}>
                              {mStr}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                onPress={handleConfirmDateTime}
                className="bg-[#0052FF] py-3 rounded-2xl items-center active:bg-blue-700"
              >
                <Text className="font-bold text-white text-sm">
                  {t("calendar.apply", { defaultValue: "Áp dụng" })} ({String(selectedDay).padStart(2, "0")}/{String(calMonth + 1).padStart(2, "0")} {selectedHour}:{selectedMinute})
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
}

// Sub-component: hàng ngày tháng
interface DateRowItemProps {
  label: string;
  value: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onPressDate: () => void;
}

function DateRowItem({ label, value, enabled, onToggle, onPressDate }: DateRowItemProps) {
  return (
    <View className="px-4 py-3.5">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-slate-800">{label}</Text>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
          thumbColor={enabled ? "#0052FF" : "#94A3B8"}
        />
      </View>
      {enabled && (
        <TouchableOpacity
          onPress={onPressDate}
          className="flex-row items-center gap-1.5 mt-1"
        >
          <Feather name="calendar" size={12} color="#0052FF" />
          <Text className="text-xs font-semibold text-[#0052FF]">{value}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
