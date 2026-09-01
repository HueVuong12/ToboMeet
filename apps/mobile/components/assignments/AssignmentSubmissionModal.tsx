import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useCreateEvidenceSignedUrlMutation } from "../../lib/redux/api/uploadsApi";
import { Attachment, Submission } from "./types";
import { useFileViewer } from "../../hooks/useFileViewer";
import FileViewerModal from "../common/FileViewerModal";

interface AssignmentSubmissionModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  channelId: string;
  existingSubmission?: Submission | null;
  onSubmit: (attachments: Attachment[]) => Promise<void>;
  isSubmitting?: boolean;
}

export default function AssignmentSubmissionModal({
  visible,
  onClose,
  roomId,
  channelId,
  existingSubmission,
  onSubmit,
  isSubmitting = false,
}: AssignmentSubmissionModalProps) {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [createEvidenceSignedUrl] = useCreateEvidenceSignedUrlMutation();
  const { selectedFile, isVisible: isFileViewerVisible, openFile, closeFile } = useFileViewer();

  useEffect(() => {
    if (existingSubmission?.attachments) {
      setAttachments(existingSubmission.attachments);
    } else {
      setAttachments([]);
    }
  }, [existingSubmission, visible]);

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
        if (asset.size && asset.size > 50 * 1024 * 1024) {
          Alert.alert(t("room.error"), t("assignments.file_too_large", { name: asset.name }));
          continue;
        }

        // 1. Get evidence signed upload URL (accessible to all authenticated users)
        const res = await createEvidenceSignedUrl({
          fileName: asset.name,
          mimeType: asset.mimeType || "application/octet-stream",
        }).unwrap();

        // 2. Upload file content directly to storage
        const uploadResult = await FileSystem.uploadAsync(res.signedUrl, asset.uri, {
          httpMethod: "PUT",
          headers: { "Content-Type": asset.mimeType || "application/octet-stream" },
        });

        if (uploadResult.status === 200 || uploadResult.status === 204) {
          setAttachments((prev) => [
            ...prev,
            {
              name: asset.name,
              url: res.url,
              size: asset.size || 0,
              type: asset.mimeType || "application/octet-stream",
              uploadedAt: new Date().toISOString(),
            },
          ]);
        } else {
          Alert.alert(t("room.error"), t("assignments.upload_failed", { name: asset.name }));
        }
      }
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickMedia = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t("room.notice"), t("assignments.grant_permission_media"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled) return;

      setIsUploading(true);

      for (const asset of result.assets) {
        const fileName = asset.fileName || `submission_${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`;
        const mimeType = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");

        const res = await createEvidenceSignedUrl({
          fileName,
          mimeType,
        }).unwrap();

        const uploadResult = await FileSystem.uploadAsync(res.signedUrl, asset.uri, {
          httpMethod: "PUT",
          headers: { "Content-Type": mimeType },
        });

        if (uploadResult.status === 200 || uploadResult.status === 204) {
          setAttachments((prev) => [
            ...prev,
            {
              name: fileName,
              url: res.url,
              size: asset.fileSize || 0,
              type: mimeType,
              uploadedAt: new Date().toISOString(),
            },
          ]);
        } else {
          Alert.alert(t("room.error"), t("assignments.upload_failed", { name: fileName }));
        }
      }
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (attachments.length === 0) {
      Alert.alert(t("room.notice"), t("assignments.attach_at_least_one"));
      return;
    }
    await onSubmit(attachments);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6 max-h-[85%] shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <View>
              <Text className="font-bold text-slate-800 text-lg">
                {existingSubmission ? t("assignments.modal_edit_submission_title") : t("assignments.modal_submission_title")}
              </Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                {t("assignments.modal_submission_desc")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Action buttons to pick files */}
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              onPress={handlePickDocument}
              disabled={isUploading}
              className="flex-1 flex-row items-center justify-center gap-2 bg-blue-50 border border-blue-200 py-3 rounded-xl active:bg-blue-100"
            >
              <Feather name="file-plus" size={18} color="#0052FF" />
              <Text className="font-bold text-blue-600 text-sm">{t("assignments.pick_doc_btn")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickMedia}
              disabled={isUploading}
              className="flex-1 flex-row items-center justify-center gap-2 bg-purple-50 border border-purple-200 py-3 rounded-xl active:bg-purple-100"
            >
              <Feather name="image" size={18} color="#9333EA" />
              <Text className="font-bold text-purple-600 text-sm">{t("assignments.pick_media_btn")}</Text>
            </TouchableOpacity>
          </View>

          {/* Upload progress loading */}
          {isUploading && (
            <View className="flex-row items-center justify-center gap-2 py-3 bg-slate-50 rounded-xl mb-4 border border-slate-100">
              <ActivityIndicator size="small" color="#0052FF" />
              <Text className="text-sm font-semibold text-slate-600">
                {t("assignments.uploading_files")}
              </Text>
            </View>
          )}

          {/* Attached Files List */}
          <Text className="font-bold text-slate-700 text-sm mb-2">
            {t("assignments.attached_files_count", { count: attachments.length })}
          </Text>

          <ScrollView className="max-h-60 mb-6">
            {attachments.length === 0 ? (
              <View className="py-8 items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Feather name="upload-cloud" size={32} color="#CBD5E1" />
                <Text className="text-slate-400 text-xs mt-2 font-medium">
                  {t("assignments.no_attached_files")}
                </Text>
              </View>
            ) : (
              attachments.map((att, idx) => (
                <View
                  key={`${att.url}-${idx}`}
                  className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2"
                >
                  <TouchableOpacity
                    onPress={() => openFile(att)}
                    className="flex-row items-center flex-1 mr-2"
                  >
                    <Feather name="file" size={18} color="#0052FF" />
                    <View className="ml-3 flex-1">
                      <Text
                        className="font-semibold text-slate-800 text-sm"
                        numberOfLines={1}
                      >
                        {att.name}
                      </Text>
                      {att.size ? (
                        <Text className="text-xs text-slate-400 mt-0.5">
                          {formatFileSize(att.size)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(idx)}
                    className="p-1.5 rounded-lg hover:bg-red-50"
                  >
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Submit button */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 py-3.5 rounded-xl bg-slate-100 items-center"
            >
              <Text className="font-bold text-slate-600 text-sm">{t("assignments.cancel_btn")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={attachments.length === 0 || isSubmitting || isUploading}
              className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center gap-2 ${
                attachments.length > 0 && !isSubmitting && !isUploading
                  ? "bg-[#0052FF] active:bg-blue-700"
                  : "bg-blue-300"
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="check" size={18} color="#ffffff" />
              )}
              <Text className="font-bold text-white text-sm">
                {existingSubmission ? t("assignments.update_submit_now") : t("assignments.submit_now")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* In-App File Viewer Modal */}
      <FileViewerModal
        visible={isFileViewerVisible}
        file={selectedFile}
        onClose={closeFile}
      />
    </Modal>
  );
}
