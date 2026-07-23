import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  useCreateReportMutation,
  useGetReportSignedUrlMutation,
} from "../../lib/redux/features/reports/reportsApi";

interface EvidenceItem {
  url: string;
  fileName: string;
  fileSize?: number;
}

interface ReportUserModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  roomId?: string;
  roomName?: string;
  roomCode?: string;
}

const REASONS = [
  "Spam",
  "Quấy rối",
  "Ngôn từ xúc phạm",
  "Chia sẻ nội dung không phù hợp",
  "Mạo danh",
  "Khác",
];

const REASON_TRANSLATIONS: Record<string, string> = {
  Spam: "room.reason_spam",
  "Quấy rối": "room.reason_harassment",
  "Ngôn từ xúc phạm": "room.reason_inappropriate_language",
  "Chia sẻ nội dung không phù hợp": "room.reason_inappropriate_content",
  "Mạo danh": "room.reason_impersonation",
  Khác: "room.reason_other",
};

export default function ReportUserModal({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  roomId,
  roomName,
  roomCode,
}: ReportUserModalProps) {
  const { t } = useTranslation();
  const [createReport, { isLoading }] = useCreateReportMutation();
  const [getReportSignedUrl] = useGetReportSignedUrlMutation();

  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setReason("");
      setDescription("");
      setEvidences([]);
      setIsUploading(false);
      setValidationError(null);
    }
  }, [visible]);

  const handlePickImage = async () => {
    if (evidences.length >= 5) {
      Alert.alert(
        t("common.notice", { defaultValue: "Thông báo" }),
        t("room.evidence_max_reached", { defaultValue: "Đã đạt giới hạn tối đa 5 ảnh minh chứng." }),
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        t("common.error", { defaultValue: "Lỗi" }),
        "Cần cấp quyền truy cập thư viện ảnh để tải minh chứng.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5 - evidences.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsUploading(true);
      try {
        const newEvidences: EvidenceItem[] = [...evidences];

        for (const asset of result.assets) {
          if (newEvidences.length >= 5) break;

          const fileName =
            asset.fileName || `evidence_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
          const mimeType = asset.mimeType || "image/jpeg";
          const fileSize = asset.fileSize || 1024 * 1024;

          const signedRes = await getReportSignedUrl({
            fileName,
            mimeType,
          }).unwrap();

          const response = await fetch(asset.uri);
          const blob = await response.blob();

          await fetch(signedRes.signedUrl, {
            method: "PUT",
            headers: {
              "Content-Type": mimeType,
            },
            body: blob,
          });

          newEvidences.push({
            url: signedRes.url,
            fileName: signedRes.fileName || fileName,
            fileSize,
          });
        }

        setEvidences(newEvidences);
      } catch (err: unknown) {
        console.error("[ReportUserModal] Error uploading evidence:", err);
        Alert.alert(
          t("common.error", { defaultValue: "Lỗi" }),
          "Tải lên minh chứng thất bại. Vui lòng thử lại.",
        );
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidences((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setValidationError(null);

    if (!reason) {
      setValidationError(t("room.report_error_reason_required"));
      return;
    }

    if (reason === "Khác" && (!description.trim() || description.trim().length < 10)) {
      setValidationError(
        t("room.report_error_description_required", {
          defaultValue: "Vui lòng nhập mô tả chi tiết khi chọn lý do 'Khác'.",
        }),
      );
      return;
    }

    try {
      await createReport({
        reportedUserId,
        reason,
        description: description.trim(),
        evidences: evidences.map((e) => ({
          url: e.url,
          fileName: e.fileName,
          fileSize: e.fileSize || 0,
        })),
        roomId,
        roomName,
        roomCode,
      }).unwrap();

      Alert.alert(
        t("common.success", { defaultValue: "Thành công" }),
        t("room.report_success", { defaultValue: "Gửi báo cáo thành công." }),
      );
      onClose();
    } catch (err: unknown) {
      const errorResponse = err as { data?: { message?: string }; message?: string };
      const msg = errorResponse?.data?.message || errorResponse?.message || t("room.report_error_failed");
      setValidationError(msg);
    }
  };

  const isSubmitDisabled =
    isLoading ||
    isUploading ||
    !reason ||
    (reason === "Khác" && description.trim().length < 10);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="w-full bg-white rounded-t-3xl overflow-hidden max-h-[90%]"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <View className="flex-1 pr-4">
              <Text className="text-xl font-bold text-slate-900">
                {t("room.report_user_title", { defaultValue: "Báo cáo người dùng" })}
              </Text>
              <Text className="text-xs text-slate-500 mt-1 font-medium" numberOfLines={1}>
                {t("room.reported_user", { defaultValue: "Người dùng" })}:{" "}
                <Text className="font-semibold text-slate-800">{reportedUserName}</Text>
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading || isUploading}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
            {/* Guide message */}
            <Text className="text-sm text-slate-500 leading-relaxed mb-5">
              {t("room.report_user_desc", {
                defaultValue:
                  "Vui lòng chọn lý do vi phạm của người dùng này. Ý kiến đóng góp của bạn giúp đội ngũ phát triển xây dựng một môi trường ToboMeet lành mạnh.",
              })}
            </Text>

            {/* Validation Error Alert */}
            {validationError && (
              <View className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100 flex-row items-center gap-2">
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text className="text-xs text-red-600 font-medium flex-1">
                  {validationError}
                </Text>
              </View>
            )}

            {/* Reason Options */}
            <Text className="text-sm font-bold text-slate-700 mb-3">
              {t("room.select_report_reason", { defaultValue: "Chọn lý do báo cáo" })} *
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {REASONS.map((r) => {
                const isSelected = reason === r;
                const i18nKey = REASON_TRANSLATIONS[r];
                const label = i18nKey ? t(i18nKey, { defaultValue: r }) : r;

                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    className={`px-4 py-2.5 rounded-full border ${
                      isSelected
                        ? "bg-blue-50 border-[#0052FF]"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected ? "text-[#0052FF]" : "text-slate-600"
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Detailed Description */}
            <Text className="text-sm font-bold text-slate-700 mb-2">
              {t("room.report_description_label", { defaultValue: "Mô tả chi tiết" })}
              {reason === "Khác" && " *"}
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              placeholder={t("room.report_description_placeholder", {
                defaultValue: "Cung cấp chi tiết sự cố...",
              })}
              placeholderTextColor="#94A3B8"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-800 mb-5 min-h-[100px]"
              style={{ textAlignVertical: "top" }}
            />

            {evidences.length < 5 && (
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isUploading}
                className="w-full border-2 border-dashed border-blue-400 bg-blue-50/40 rounded-2xl p-5 items-center justify-center mb-3 active:bg-blue-100/50"
              >
                {isUploading ? (
                  <View className="items-center py-2">
                    <ActivityIndicator size="small" color="#0052FF" />
                    <Text className="text-xs text-blue-600 font-medium mt-2">
                      Đang tải ảnh lên...
                    </Text>
                  </View>
                ) : (
                  <View className="items-center">
                    <View className="w-10 h-10 rounded-full bg-blue-100/80 justify-center items-center mb-2">
                      <Feather name="upload-cloud" size={22} color="#0052FF" />
                    </View>
                    <Text className="text-sm font-bold text-slate-800 text-center mb-1">
                      {t("room.evidence_tap_to_select")}
                    </Text>
                    <Text className="text-xs text-slate-400 text-center leading-relaxed px-2">
                      {t("room.evidence_format_hint")}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Selected Evidence Thumbnails List */}
            {evidences.length > 0 && (
              <View className="flex-row flex-wrap gap-3 mb-2">
                {evidences.map((ev, index) => (
                  <View
                    key={index}
                    className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm"
                  >
                    <Image source={{ uri: ev.url }} className="w-full h-full" />
                    <TouchableOpacity
                      onPress={() => handleRemoveEvidence(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/75 justify-center items-center shadow-md"
                    >
                      <Feather name="x" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View className="p-4 border-t border-slate-100 bg-white flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitDisabled}
              className="px-4 py-2.5 rounded-xl bg-slate-100 justify-center items-center"
            >
              <Text className="text-sm font-medium text-slate-600">
                {t("room.cancel")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              className={`px-5 py-2.5 rounded-xl bg-red-600 active:bg-red-700 justify-center items-center flex-row gap-2 ${
                isSubmitDisabled ? "opacity-50" : ""
              }`}
            >
              {isLoading || isUploading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="flag" size={15} color="#ffffff" />
              )}
              <Text className="text-white font-bold text-sm">
                {t("room.submit_report")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
