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
  fileType: string;
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
  "Khác": "room.reason_other",
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

  if (!visible) return null;

  const handlePickImage = async () => {
    try {
      let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!permission.granted) {
        Alert.alert(t("room.notice"), t("room.permission_denied", "Permission to access photo library was denied."));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploading(true);

        const fileName = asset.fileName || `evidence_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || "image/jpeg";
        const { signedUrl, url } = await getReportSignedUrl({ fileName, mimeType }).unwrap();

        const fileRes = await fetch(asset.uri);
        const blob = await fileRes.blob();

        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": mimeType,
          },
        });

        if (uploadRes.ok) {
          setEvidences((prev) => [
            ...prev,
            {
              url,
              fileName,
              fileType: "image",
            },
          ]);
        } else {
          Alert.alert(t("room.error"), t("room.upload_failed", "Failed to upload image. Please try again."));
        }
      }
    } catch (err) {
      console.log("Evidence upload error:", err);
      Alert.alert(t("room.error"), t("room.upload_failed", "Failed to upload image. Please try again."));
    } finally {
      setIsUploading(false);
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

    if (reason === "Khác" && !description.trim()) {
      setValidationError(t("room.report_error_description_required"));
      return;
    }

    try {
      await createReport({
        reportedUserId,
        reason,
        description: description.trim(),
        evidences,
        roomId,
        roomName,
        roomCode,
      }).unwrap();

      Alert.alert(t("room.success"), t("room.report_success"));
      onClose();
    } catch (err: any) {
      const msg = err?.data?.message || t("room.report_error_failed");
      Alert.alert(t("room.error"), msg);
    }
  };

  const isSubmitDisabled = isLoading || isUploading;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => !isSubmitDisabled && onClose()}
          className="absolute inset-0"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl z-10 border border-slate-100 max-h-[85%]"
        >
          {/* Header */}
          <View className="px-6 py-4 border-b border-slate-100 flex-row justify-between items-center bg-white">
            <View className="flex-row items-center gap-2">
              <Feather name="flag" size={18} color="#EF4444" />
              <Text className="font-bold text-slate-900 text-lg">
                {t("room.report_user")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitDisabled}
              className="p-1.5 rounded-full hover:bg-slate-100"
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Reported User Info */}
            <View className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-4 flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-full bg-red-100 justify-center items-center">
                <Text className="font-bold text-red-600 text-sm">
                  {reportedUserName?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-slate-400 font-medium">
                  {t("room.reporting_user")}
                </Text>
                <Text className="text-sm font-bold text-slate-800">
                  {reportedUserName}
                </Text>
              </View>
            </View>

            {/* Validation Error Banner */}
            {validationError && (
              <View className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex-row items-center gap-2">
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text className="text-xs text-red-600 font-medium flex-1">
                  {validationError}
                </Text>
              </View>
            )}

            {/* Reasons List */}
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              {t("room.select_report_reason")} <Text className="text-red-500">*</Text>
            </Text>
            <View className="gap-2 mb-4">
              {REASONS.map((r) => {
                const isSelected = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setReason(r)}
                    className={`flex-row items-center justify-between p-3.5 rounded-xl border ${
                      isSelected
                        ? "bg-red-50/70 border-red-400"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-red-700 font-bold" : "text-slate-700"
                      }`}
                    >
                      {t(REASON_TRANSLATIONS[r] || r)}
                    </Text>
                    <View
                      className={`w-5 h-5 rounded-full border justify-center items-center ${
                        isSelected
                          ? "border-red-600 bg-red-600"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description Textarea */}
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {t("room.report_description_label")}{" "}
              {reason === "Khác" && <Text className="text-red-500">*</Text>}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t("room.report_description_placeholder")}
              placeholderTextColor="#94A3B8"
              multiline
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 min-h-[80px] mb-4"
              style={{ textAlignVertical: "top" }}
            />

            {/* Evidence Upload Section - Web Matching Design */}
            <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {t("room.evidence_title_optional")}
            </Text>

            {/* Blue Dashed Drag/Tap Container */}
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
