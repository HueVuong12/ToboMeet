import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { FileViewerItem, getFileCategory } from "../../hooks/useFileViewer";
import { useTranslation } from "react-i18next";

let Sharing: any = null;
try {
  Sharing = require("expo-sharing");
} catch (e) {
  console.warn("expo-sharing is not available natively:", e);
}

interface FileViewerModalProps {
  visible: boolean;
  file: FileViewerItem | null;
  onClose: () => void;
}

export default function FileViewerModal({
  visible,
  file,
  onClose,
}: FileViewerModalProps) {
  const { t } = useTranslation();
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [isOpeningNative, setIsOpeningNative] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsLoadingImage(true);
      setIsOpeningNative(false);
    }
  }, [visible, file?.url]);

  if (!visible || !file) return null;

  const category = getFileCategory(file);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Open file locally via Native Device App (expo-sharing) without launching browser
  const handleOpenNativeDeviceApp = async () => {
    if (!file.url) return;
    setIsOpeningNative(true);

    try {
      // 1. Sanitize file name
      const safeName = (file.name || "file_download").replace(/[^a-zA-Z0-9._-]/g, "_");
      const localUri = `${FileSystem.documentDirectory}${Date.now()}_${safeName}`;

      // 2. Download raw file bytes to local cache
      const downloadResult = await FileSystem.downloadAsync(file.url, localUri);

      if (downloadResult.status !== 200) {
        throw new Error(t("assignments.toast_error_generic", { defaultValue: "Không thể tải tập tin" }));
      }

      // 3. Launch Native OS Share / Viewer intent
      if (Sharing && typeof Sharing.isAvailableAsync === "function") {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: file.type || "application/octet-stream",
            dialogTitle: file.name,
            UTI: file.type || "public.data",
          });
          return;
        }
      }

      Alert.alert(
        t("room.notice", { defaultValue: "Thông báo" }),
        t("files.success_folder_download", { defaultValue: `Đã lưu tệp tại: ${downloadResult.uri}` })
      );
    } catch (err: any) {
      console.error("Open native file error:", err);
      Alert.alert(
        t("room.error", { defaultValue: "Lỗi" }),
        err?.message || t("assignments.toast_error_generic", { defaultValue: "Không thể mở tập tin" })
      );
    } finally {
      setIsOpeningNative(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <SafeAreaView className="flex-1 bg-slate-900">
        {/* Header Bar */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View className="flex-1 mx-3 items-center">
            <Text
              className="text-white font-bold text-sm text-center"
              numberOfLines={1}
            >
              {file.name}
            </Text>
            {!!file.size && (
              <Text className="text-slate-400 text-xs mt-0.5">
                {formatFileSize(file.size)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleOpenNativeDeviceApp}
            disabled={isOpeningNative}
            className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center active:opacity-80 disabled:opacity-50"
          >
            {isOpeningNative ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="share" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Content Container */}
        <View className="flex-1 items-center justify-center bg-slate-950 p-4">
          {/* 1. IMAGE PREVIEW */}
          {category === "image" && (
            <View className="w-full h-full justify-center items-center relative">
              {isLoadingImage && (
                <View className="absolute inset-0 items-center justify-center z-10 bg-slate-950/60">
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text className="text-slate-400 text-xs mt-2">
                    {t("common.loading", { defaultValue: "Đang tải ảnh..." })}
                  </Text>
                </View>
              )}
              <Image
                source={{ uri: file.url }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
                onLoadStart={() => setIsLoadingImage(true)}
                onLoadEnd={() => setIsLoadingImage(false)}
              />
            </View>
          )}

          {/* 2. PDF PREVIEW */}
          {category === "pdf" && (
            <View className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 items-center shadow-xl">
              <View className="w-20 h-20 rounded-2xl bg-red-500/10 items-center justify-center mb-4">
                <Feather name="file-text" size={48} color="#EF4444" />
              </View>
              <Text
                className="text-white font-bold text-base text-center mb-2"
                numberOfLines={2}
              >
                {file.name}
              </Text>
              <Text className="text-slate-400 text-xs text-center mb-6">
                {t("files.pdf_document", { defaultValue: "Tài liệu PDF" })} • {formatFileSize(file.size)}
              </Text>

              <TouchableOpacity
                onPress={handleOpenNativeDeviceApp}
                disabled={isOpeningNative}
                className="w-full bg-blue-600 py-3.5 px-6 rounded-2xl flex-row items-center justify-center active:opacity-80 disabled:opacity-50"
              >
                {isOpeningNative ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="external-link" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm ml-2">
                      {t("files.open_in_device", { defaultValue: "Mở bằng ứng dụng trên máy" })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* 3. OFFICE DOCUMENT PREVIEW */}
          {category === "office" && (
            <View className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 items-center shadow-xl">
              <View className="w-20 h-20 rounded-2xl bg-blue-500/10 items-center justify-center mb-4">
                <Feather name="file" size={48} color="#3B82F6" />
              </View>
              <Text
                className="text-white font-bold text-base text-center mb-2"
                numberOfLines={2}
              >
                {file.name}
              </Text>
              <Text className="text-slate-400 text-xs text-center mb-6">
                {t("files.office_document", { defaultValue: "Văn bản / Bảng tính Office" })} • {formatFileSize(file.size)}
              </Text>

              <TouchableOpacity
                onPress={handleOpenNativeDeviceApp}
                disabled={isOpeningNative}
                className="w-full bg-blue-600 py-3.5 px-6 rounded-2xl flex-row items-center justify-center active:opacity-80 disabled:opacity-50"
              >
                {isOpeningNative ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="external-link" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm ml-2">
                      {t("files.open_in_device", { defaultValue: "Mở bằng ứng dụng trên máy" })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* 4. OTHER FILE TYPES */}
          {category === "other" && (
            <View className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 items-center shadow-xl">
              <View className="w-20 h-20 rounded-2xl bg-amber-500/10 items-center justify-center mb-4">
                <Feather name="paperclip" size={48} color="#F59E0B" />
              </View>
              <Text
                className="text-white font-bold text-base text-center mb-2"
                numberOfLines={2}
              >
                {file.name}
              </Text>
              <Text className="text-slate-400 text-xs text-center mb-6">
                {t("files.general_document", { defaultValue: "Tập tin đính kèm" })} • {formatFileSize(file.size)}
              </Text>

              <TouchableOpacity
                onPress={handleOpenNativeDeviceApp}
                disabled={isOpeningNative}
                className="w-full bg-amber-600 py-3.5 px-6 rounded-2xl flex-row items-center justify-center active:opacity-80 disabled:opacity-50"
              >
                {isOpeningNative ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="download" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm ml-2">
                      {t("files.download_and_open", { defaultValue: "Tải về & Mở trên thiết bị" })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
