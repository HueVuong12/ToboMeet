import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

interface DeleteEventConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (deleteType: "single" | "all") => void;
  isRecurring?: boolean;
  occurrenceDate?: string;
  isLoading?: boolean;
}

export default function DeleteEventConfirmModal({
  visible,
  onClose,
  onConfirm,
  isRecurring = false,
  occurrenceDate,
  isLoading = false,
}: DeleteEventConfirmModalProps) {
  const { t, i18n } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<"single" | "all">("single");

  useEffect(() => {
    if (visible) {
      setSelectedOption("single");
    }
  }, [visible]);

  if (!visible) return null;

  const formatOccurrenceDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) return dateStr;
      const daysFullVi = [
        "Chủ nhật",
        "Thứ hai",
        "Thứ ba",
        "Thứ tư",
        "Thứ năm",
        "Thứ sáu",
        "Thứ bảy",
      ];
      const daysFullEn = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayOfWeek = i18n.language === "vi" ? daysFullVi[date.getDay()] : daysFullEn[date.getDay()];
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${dayOfWeek}, ${pad(day)}/${pad(month)}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formattedDate = formatOccurrenceDate(occurrenceDate);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900/50 justify-center items-center px-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100">
          {/* Header Icon + Title */}
          <View className="flex-row items-center gap-3.5 mb-3">
            <View className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 items-center justify-center">
              <Feather
                name={isRecurring ? "calendar" : "alert-triangle"}
                size={22}
                color="#E11D48"
              />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-slate-800 text-lg leading-tight">
                {isRecurring
                  ? t("calendar.delete_modal.recurring_title", {
                      defaultValue: "Hủy sự kiện định kỳ",
                    })
                  : t("calendar.delete_modal.single_title", {
                      defaultValue: "Hủy sự kiện",
                    })}
              </Text>
              <Text className="text-xs text-slate-400 font-medium mt-0.5">
                {isRecurring
                  ? t("calendar.delete_modal.recurring_subtitle", {
                      defaultValue: "Chọn phạm vi áp dụng cho hành động này",
                    })
                  : t("calendar.delete_modal.single_subtitle", {
                      defaultValue: "Xác nhận hủy sự kiện",
                    })}
              </Text>
            </View>
          </View>

          {isRecurring ? (
            <View className="my-4">
              <Text className="text-xs text-slate-600 leading-relaxed mb-3">
                {t("calendar.delete_modal.recurring_prompt", {
                  defaultValue:
                    "Đây là một sự kiện định kỳ. Bạn muốn hủy chỉ sự kiện này hay toàn bộ chuỗi sự kiện?",
                })}
              </Text>

              {/* Radio Options */}
              <View className="gap-2.5">
                {/* Option 1: Single */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedOption("single")}
                  className={`flex-row items-start gap-3 p-3.5 rounded-2xl border ${
                    selectedOption === "single"
                      ? "border-rose-500 bg-rose-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <View className="pt-0.5">
                    <View
                      className={`w-4 h-4 rounded-full border items-center justify-center ${
                        selectedOption === "single"
                          ? "border-rose-600 bg-rose-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {selectedOption === "single" && (
                        <View className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </View>
                  </View>

                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800">
                      {t("calendar.delete_modal.single_option_title", {
                        defaultValue: "Xoá sự kiện này",
                      })}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {formattedDate
                        ? t("calendar.delete_modal.single_option_desc_with_date", {
                            date: formattedDate,
                            defaultValue: `Chỉ hủy sự kiện vào ${formattedDate}. Các buổi khác trong chuỗi vẫn diễn ra bình thường.`,
                          })
                        : t("calendar.delete_modal.single_option_desc", {
                            defaultValue:
                              "Chỉ hủy riêng sự kiện được chọn này. Chuỗi sự kiện vẫn tiếp tục.",
                          })}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: All */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedOption("all")}
                  className={`flex-row items-start gap-3 p-3.5 rounded-2xl border ${
                    selectedOption === "all"
                      ? "border-rose-500 bg-rose-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <View className="pt-0.5">
                    <View
                      className={`w-4 h-4 rounded-full border items-center justify-center ${
                        selectedOption === "all"
                          ? "border-rose-600 bg-rose-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {selectedOption === "all" && (
                        <View className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </View>
                  </View>

                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-800">
                      {t("calendar.delete_modal.all_option_title", {
                        defaultValue: "Xoá tất cả",
                      })}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {t("calendar.delete_modal.all_option_desc", {
                        defaultValue:
                          "Hủy toàn bộ tất cả các buổi trong chuỗi sự kiện định kỳ này.",
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text className="text-sm text-slate-600 my-5 leading-relaxed">
              {t("calendar.delete_modal.single_prompt", {
                defaultValue:
                  "Bạn có chắc chắn muốn hủy sự kiện này không? Hành động này không thể hoàn tác.",
              })}
            </Text>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3 pt-2">
            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading}
              className="flex-1 py-3 border border-slate-200 rounded-xl items-center justify-center active:bg-slate-50"
            >
              <Text className="text-sm font-semibold text-slate-700">
                {t("calendar.delete_modal.cancel", { defaultValue: "Hủy" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onConfirm(isRecurring ? selectedOption : "all")}
              disabled={isLoading}
              className="flex-1 py-3 bg-rose-600 rounded-xl items-center justify-center active:bg-rose-700 flex-row gap-1.5"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {t("calendar.delete_modal.confirm", {
                    defaultValue: "Xác nhận",
                  })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
