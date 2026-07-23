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
  useCreateRoomReportMutation,
  useGetReportSignedUrlMutation,
} from "../../lib/redux/features/reports/reportsApi";

interface EvidenceItem {
  url: string;
  fileName: string;
  fileSize?: number;
}

interface ReportRoomModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

const REASONS = [
  "Quấy rối",
  "Spam",
  "Nội dung phản cảm",
  "Lừa đảo",
  "Chia sẻ thông tin sai sự thật",
  "Vi phạm bản quyền",
  "Khác",
];

const REASON_TRANSLATIONS: Record<string, string> = {
  "Quấy rối": "room.reason_harassment",
  Spam: "room.reason_spam",
  "Nội dung phản cảm": "room.reason_inappropriate_content_room",
  "Lừa đảo": "room.reason_scam",
  "Chia sẻ thông tin sai sự thật": "room.reason_fake_info",
  "Vi phạm bản quyền": "room.reason_copyright",
  Khác: "room.reason_other",
};

export default function ReportRoomModal({
  visible,
  onClose,
  roomId,
  roomName,
}: ReportRoomModalProps) {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [createRoomReport, { isLoading }] = useCreateRoomReportMutation();
  const [getReportSignedUrl] = useGetReportSignedUrlMutation();

  useEffect(() => {
    if (visible) {
      setSelectedReason("");
      setDescription("");
      setEvidences([]);
      setUploading(false);
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - evidences.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploading(true);
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
      } catch (err: any) {
        console.error("[ReportRoomModal] Error uploading evidence:", err);
        Alert.alert(
          t("common.error", { defaultValue: "Lỗi" }),
          "Tải lên minh chứng thất bại. Vui lòng thử lại.",
        );
      } finally {
        setUploading(false);
      }
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidences((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setValidationError(null);

    if (!selectedReason) {
      setValidationError(t("room.report_error_reason_required"));
      return;
    }

    if (selectedReason === "Khác" && (!description.trim() || description.trim().length < 10)) {
      setValidationError(
        t("room.report_error_description_required", {
          defaultValue: "Vui lòng nhập mô tả chi tiết khi chọn lý do 'Khác'.",
        }),
      );
      return;
    }

    try {
      await createRoomReport({
        roomId,
        reason: selectedReason,
        description: description.trim(),
        attachments: evidences.map((e) => ({
          url: e.url,
          fileName: e.fileName,
          fileSize: e.fileSize || 0,
        })),
      }).unwrap();

      Alert.alert(
        t("common.success", { defaultValue: "Thành công" }),
        t("room.report_room_success", {
          defaultValue: "Báo cáo phòng họp đã được gửi thành công.",
        }),
      );
      onClose();
    } catch (err: any) {
      console.error("[ReportRoomModal] Error submitting room report:", err);
      const errMsg =
        err?.data?.message || err?.message || t("room.report_error_failed");
      setValidationError(errMsg);
    }
  };

  const isSubmitDisabled =
    isLoading ||
    uploading ||
    !selectedReason ||
    (selectedReason === "Khác" && description.trim().length < 10);

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
                {t("room.report_room_title", { defaultValue: "Báo cáo phòng họp" })}
              </Text>
              <Text className="text-xs text-slate-500 mt-1 font-medium" numberOfLines={1}>
                {t("room.room", { defaultValue: "Phòng" })}:{" "}
                <Text className="font-semibold text-slate-800">{roomName}</Text>
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={isLoading || uploading}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
            {/* Guide message */}
            <Text className="text-sm text-slate-500 leading-relaxed mb-5">
              {t("room.report_room_desc", {
                defaultValue:
                  "Vui lòng chọn lý do vi phạm của phòng họp này. Ý kiến đóng góp của bạn giúp đội ngũ phát triển xây dựng một môi trường ToboMeet lành mạnh.",
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
                const isSelected = selectedReason === r;
                const i18nKey = REASON_TRANSLATIONS[r];
                const label = i18nKey ? t(i18nKey, { defaultValue: r }) : r;

                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setSelectedReason(r)}
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
              {selectedReason === "Khác" && " *"}
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

            {/* Attachments Section */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-bold text-slate-700">
                  {t("room.evidence_label", { defaultValue: "Minh chứng (Ảnh chụp màn hình/Bằng chứng)" })}
                </Text>
                <Text className="text-xs text-slate-400 font-medium">
                  {evidences.length}/5
                </Text>
              </View>

              {/* Image Preview List */}
              {evidences.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3 mb-3">
                  {evidences.map((item, index) => (
                    <View key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                      <Image source={{ uri: item.url }} className="w-full h-full" />
                      <TouchableOpacity
                        onPress={() => handleRemoveEvidence(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full items-center justify-center"
                      >
                        <Feather name="x" size={12} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Add Evidence Button */}
              {evidences.length < 5 && (
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={uploading}
                  className="w-full py-3.5 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex-row items-center justify-center gap-2"
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#0052FF" />
                  ) : (
                    <>
                      <Feather name="image" size={18} color="#64748B" />
                      <Text className="text-xs font-semibold text-slate-600">
                        {t("room.add_evidence", { defaultValue: "Thêm minh chứng" })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              className={`w-full py-4 rounded-2xl items-center justify-center mb-8 ${
                isSubmitDisabled ? "bg-slate-200" : "bg-[#0052FF]"
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {t("room.submit_report", { defaultValue: "Gửi báo cáo" })}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
