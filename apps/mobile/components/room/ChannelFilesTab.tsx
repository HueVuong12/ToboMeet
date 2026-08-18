import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  Linking,
  Modal,
  Image,
  Platform,
  StatusBar,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import {
  useGetChannelFilesQuery,
  useCreateSignedUploadUrlMutation,
  useSaveFileMetaMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
  useLazyGetDownloadUrlQuery,
  usePinFileMutation,
  useUnpinFileMutation,
} from "../../lib/redux/api/channelFilesApi";
import { ChannelFileResponse } from "@tobomeet/shared/types";
import { supabase } from "../../lib/supabase";
import { useTranslation } from "react-i18next";

interface ChannelFilesTabProps {
  roomId: string;
  channelId: string;
  userId: string;
  canManageFiles: boolean; // True nếu là Owner hoặc Admin (Phó nhóm)
}

export default function ChannelFilesTab({
  roomId,
  channelId,
  canManageFiles,
}: ChannelFilesTabProps) {
  const { t } = useTranslation();
  const { data: files = [], isLoading, refetch } = useGetChannelFilesQuery({
    roomId,
    channelId,
  });

  const [createSignedUploadUrl] = useCreateSignedUploadUrlMutation();
  const [saveFileMeta] = useSaveFileMetaMutation();
  const [renameFile] = useRenameFileMutation();
  const [deleteFile] = useDeleteFileMutation();
  const [triggerDownload] = useLazyGetDownloadUrlQuery();
  const [pinFile] = usePinFileMutation();
  const [unpinFile] = useUnpinFileMutation();

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);

  // Rename & Options State
  const [selectedFileForMenu, setSelectedFileForMenu] = useState<ChannelFileResponse | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Upload Action Menu state
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  // Create Folder Modal state
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Preview State
  const [previewFile, setPreviewFile] = useState<ChannelFileResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Format Date (thống nhất với Web)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper File Icon
  const getFileIcon = (mimeType: string = "", fileName: string): React.ComponentProps<typeof Feather>["name"] => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return "image";
    }
    if (mimeType.startsWith("video/") || ["mp4", "mkv", "avi", "mov"].includes(ext)) {
      return "video";
    }
    if (mimeType.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(ext)) {
      return "music";
    }
    if (mimeType.includes("pdf") || ext === "pdf") {
      return "file-text";
    }
    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      ["xls", "xlsx", "csv"].includes(ext)
    ) {
      return "grid";
    }
    return "file";
  };

  // Handle Pick and Upload File
  const handlePickAndUpload = async () => {
    if (!canManageFiles) {
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), t("files.error_permission_upload"));
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const doc = result.assets[0];
      if (doc.size && doc.size > 50 * 1024 * 1024) {
        Alert.alert(t("room.error", { defaultValue: "Lỗi" }), t("files.error_size_limit"));
        return;
      }

      setIsUploading(true);

      // 1. Xin signed upload url
      const res = await createSignedUploadUrl({
        roomId,
        channelId,
        fileName: doc.name,
      }).unwrap();

      // 2. Upload file
      const uploadResult = await FileSystem.uploadAsync(res.signedUrl, doc.uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": doc.mimeType || "application/octet-stream" },
      });

      if (uploadResult.status !== 200) {
        throw new Error(t("files.error_upload_cloud"));
      }

      // 3. Lưu meta
      await saveFileMeta({
        roomId,
        channelId,
        fileName: doc.name,
        storagePath: res.storagePath,
        publicUrl: res.publicUrl,
        mimeType: doc.mimeType || "application/octet-stream",
        fileSize: doc.size || 0,
        parentFolderId: currentFolderId,
      }).unwrap();

      Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_upload"));
      refetch();
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || errorObj?.message || t("files.error_upload_failed"));
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Create Empty Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      await saveFileMeta({
        roomId,
        channelId,
        fileName: newFolderName.trim(),
        isFolder: true,
        parentFolderId: currentFolderId,
      }).unwrap();
      setIsCreateFolderModalOpen(false);
      setNewFolderName("");
      refetch();
      Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_create_folder"));
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || t("files.error_create_folder_failed"));
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle Pick and Upload Media (Hình ảnh và video)
  const handlePickAndUploadMedia = async () => {
    if (!canManageFiles) {
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), t("files.error_permission_upload_general"));
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t("room.error", { defaultValue: "Lỗi" }), t("files.error_permission_library"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `media_${Date.now()}`;
      const mimeType = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");

      setIsUploading(true);

      // 1. Xin signed upload url
      const res = await createSignedUploadUrl({
        roomId,
        channelId,
        fileName,
      }).unwrap();

      // 2. Upload file
      const uploadResult = await FileSystem.uploadAsync(res.signedUrl, asset.uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": mimeType },
      });

      if (uploadResult.status !== 200) {
        throw new Error(t("files.error_upload_cloud"));
      }

      // 3. Lưu meta — parentFolderId là thư mục hiện tại
      await saveFileMeta({
        roomId,
        channelId,
        fileName,
        storagePath: res.storagePath,
        publicUrl: res.publicUrl,
        mimeType,
        fileSize: asset.fileSize || 0,
        parentFolderId: currentFolderId,
      }).unwrap();

      Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_upload_general"));
      refetch();
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || errorObj?.message || t("files.error_upload_general_failed"));
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Download File
  const handleDownload = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: true }).unwrap();
      const supported = await Linking.canOpenURL(res.downloadUrl);
      if (supported) {
        await Linking.openURL(res.downloadUrl);
      } else {
        Alert.alert(t("room.error", { defaultValue: "Lỗi" }), t("files.error_download_link_failed"));
      }
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || t("files.error_download_url_failed"));
    }
  };

  // Handle Open and Preview File
  const handleOpenFile = async (file: ChannelFileResponse) => {
    try {
      // Gọi API lấy link download dạng preview (download=false)
      const res = await triggerDownload({ fileId: file._id, download: false }).unwrap();
      setPreviewUrl(res.downloadUrl);
      setPreviewFile(file);
      setIsPreviewVisible(true);
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || t("files.error_preview_failed"));
    }
  };

  // Render Preview Content by File Type
  const renderPreviewContent = (file: ChannelFileResponse, url: string) => {
    const ext = file.fileName.split(".").pop()?.toLowerCase() || "";
    const mime = file.mimeType || "";

    // 1. Hình ảnh
    if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return (
        <Image
          source={{ uri: url }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      );
    }

    // 2. Video
    if (mime.startsWith("video/") || ["mp4", "mkv", "avi", "mov"].includes(ext)) {
      return (
        <View className="items-center justify-center p-6 bg-slate-900 rounded-2xl border border-slate-800 m-4">
          <Feather name="video" size={64} color="#3B82F6" />
          <Text className="text-white text-base font-bold mt-4 text-center" numberOfLines={2}>
            {file.fileName}
          </Text>
          <Text className="text-slate-400 text-sm mt-3 text-center">
            {t("files.preview_video_not_supported")}
          </Text>
          <TouchableOpacity
            onPress={() => handleDownload(file)}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-bold text-sm">{t("files.download_video")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Audio
    if (mime.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(ext)) {
      return (
        <View className="items-center justify-center p-6 bg-slate-900 rounded-2xl border border-slate-800 m-4">
          <Feather name="music" size={64} color="#10B981" />
          <Text className="text-white text-base font-bold mt-4 text-center" numberOfLines={2}>
            {file.fileName}
          </Text>
          <Text className="text-slate-400 text-sm mt-3 text-center">
            {t("files.preview_audio_not_supported")}
          </Text>
          <TouchableOpacity
            onPress={() => handleDownload(file)}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-bold text-sm">{t("files.download_audio")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 4. PDF
    if (mime.includes("pdf") || ext === "pdf") {
      return (
        <View className="items-center justify-center p-6 bg-slate-900 rounded-2xl border border-slate-800 m-4">
          <Feather name="file-text" size={64} color="#D97706" />
          <Text className="text-white text-base font-bold mt-4 text-center" numberOfLines={2}>
            {file.fileName}
          </Text>
          <Text className="text-slate-400 text-sm mt-3 text-center">
            {t("files.preview_pdf_not_supported")}
          </Text>
          <TouchableOpacity
            onPress={() => handleDownload(file)}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-bold text-sm">{t("files.download_pdf")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 5. Loại tệp khác không hỗ trợ preview
    return (
      <View className="items-center justify-center p-6 bg-slate-900 rounded-2xl border border-slate-800 m-4">
        <Feather name="file" size={64} color="#94A3B8" />
        <Text className="text-white text-base font-bold mt-4 text-center" numberOfLines={2}>
          {file.fileName}
        </Text>
        <Text className="text-slate-400 text-sm mt-3 text-center">
          {t("files.preview_general_not_supported")}
        </Text>
        <TouchableOpacity
          onPress={() => handleDownload(file)}
          className="mt-6 bg-blue-600 px-6 py-3 rounded-xl active:opacity-80"
        >
          <Text className="text-white font-bold text-sm">{t("files.download_file")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Tải xuống thư mục dưới dạng ZIP (Mobile)
  const handleDownloadFolder = async (file: ChannelFileResponse) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://dolphin-paternity-estrogen.ngrok-free.dev/api";
      const downloadUrl = `${API_BASE_URL}/channel-files/${file._id}/download-folder`;
      const localUri = `${FileSystem.documentDirectory}${file.fileName}.zip`;

      Alert.alert(t("files.toast_preparing_download"), t("files.info_preparing_download"));

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri, {
        headers,
      });

      if (downloadResult.status === 200) {
        let Sharing: any;
        try {
          Sharing = require("expo-sharing");
        } catch (e) {
          console.warn("expo-sharing module is not available natively:", e);
        }

        if (Sharing && typeof Sharing.isAvailableAsync === "function") {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: "application/zip",
              dialogTitle: `${t("files.download_file")} ${file.fileName}.zip`,
            });
            return;
          }
        }

        Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_folder_download", { uri: downloadResult.uri }));
      } else {
        throw new Error(t("files.error_folder_download_code", { status: downloadResult.status }));
      }
    } catch (err) {
      console.error("Mobile download folder error:", err);
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), t("files.error_folder_download_failed"));
    }
  };



  // Rename File
  const handleRename = async () => {
    if (!selectedFileForMenu || !newNameInput.trim()) return;
    try {
      await renameFile({
        fileId: selectedFileForMenu._id,
        newName: newNameInput.trim(),
        channelId,
      }).unwrap();
      setShowRenameModal(false);
      setShowMenuModal(false);
      refetch();
      Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_rename"));
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || t("files.error_rename_failed"));
    }
  };

  // Delete File
  const handleDelete = (file: ChannelFileResponse) => {
    Alert.alert(
      t("files.confirm_delete_title"),
      t("files.confirm_delete_msg", { name: file.fileName }),
      [
        { text: t("files.btn_cancel"), style: "cancel" },
        {
          text: t("files.btn_delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFile({ fileId: file._id, channelId }).unwrap();
              setShowMenuModal(false);
              refetch();
              Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_delete"));
            } catch (err) {
              const errorObj = err as { data?: { message?: string }; message?: string };
              Alert.alert(t("room.error", { defaultValue: "Lỗi" }), errorObj?.data?.message || t("files.error_delete_failed"));
            }
          },
        },
      ],
    );
  };

  // Ghim tệp/thư mục
  const handlePin = async (file: ChannelFileResponse) => {
    // Đếm số lượng tệp/thư mục đang được ghim trong kênh hiện tại
    const pinnedCount = files.filter((f: any) => f.isPinned).length;
    if (pinnedCount >= 3) {
      Alert.alert(t("room.notice", { defaultValue: "Thông báo" }), t("files.error_pin_limit_msg"));
      return;
    }

    try {
      await pinFile({ fileId: file._id, channelId }).unwrap();
      Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_pin"));
    } catch (err: any) {
      const serverMsg = err?.data?.message || err?.message;
      if (serverMsg && (serverMsg.includes("tối đa 3") || serverMsg.includes("max") || serverMsg.includes("limit"))) {
        Alert.alert(t("room.notice", { defaultValue: "Thông báo" }), t("files.error_pin_limit_msg"));
      } else {
        Alert.alert(t("room.error", { defaultValue: "Lỗi" }), serverMsg || t("files.error_pin_failed"));
      }
    }
  };

  // Bỏ ghim tệp/thư mục
  const handleUnpin = async (file: ChannelFileResponse) => {
    try {
      await unpinFile({ fileId: file._id, channelId }).unwrap();
      Alert.alert(t("room.success", { defaultValue: "Thành công" }), t("files.success_unpin"));
    } catch (err: any) {
      Alert.alert(t("room.error", { defaultValue: "Lỗi" }), err?.data?.message || t("files.error_unpin_failed"));
    }
  };

  // Search & folder filtering (default sorted by createdAt desc for unpinned files)
  const filteredFiles = useMemo(() => {
    let result = [...files];
    if (searchTerm.trim() !== "") {
      result = files.filter((f: ChannelFileResponse) =>
        f.fileName.toLowerCase().includes(searchTerm.toLowerCase().trim()),
      );
    } else {
      result = files.filter((f: ChannelFileResponse) =>
        (f.parentFolderId || null) === currentFolderId
      );
    }

    // Tách riêng danh sách đã ghim và chưa ghim
    const pinned = result.filter((f) => f.isPinned);
    const unpinned = result.filter((f) => !f.isPinned);

    // Ghim trước lên đầu (sắp xếp tăng dần theo pinnedAt)
    pinned.sort((a: any, b: any) => {
      const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return timeA - timeB;
    });

    // Sắp xếp các mục chưa ghim mặc định theo thời gian tạo giảm dần (mới nhất lên đầu)
    unpinned.sort((a: ChannelFileResponse, b: ChannelFileResponse) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    return [...pinned, ...unpinned];
  }, [files, searchTerm, currentFolderId]);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Action Bar (Search & Upload) */}
      <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder={t("files.search_placeholder")}
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="flex-1 ml-2 text-sm text-slate-800 focus:outline-none"
          />
        </View>

        {/* Chỉ hiển thị nút + với Owner / Admin */}
        {canManageFiles && (
          <TouchableOpacity
            onPress={() => setShowUploadMenu(true)}
            disabled={isUploading}
            className="w-10 h-10 bg-blue-600 rounded-xl items-center justify-center active:opacity-80 disabled:opacity-50"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="plus" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        )}
      </View>



      {/* Mobile Breadcrumb navigation */}
      {currentFolderId !== null && (
        <View className="px-4 py-2 bg-white flex-row items-center border-b border-slate-100">
          <TouchableOpacity
            onPress={() => {
              const currentFolder = files.find((f: any) => f._id === currentFolderId);
              setCurrentFolderId(currentFolder?.parentFolderId || null);
            }}
            className="flex-row items-center gap-1.5"
          >
            <Feather name="arrow-left" size={16} color="#0052FF" />
            <Text className="text-sm font-bold text-blue-600">{t("files.btn_back")}</Text>
          </TouchableOpacity>
          <View className="w-px h-4 bg-slate-200 mx-3" />
          <Text className="text-sm text-slate-500 font-semibold truncate flex-1">
            {files.find((f: any) => f._id === currentFolderId)?.fileName || t("files.folder_label")}
          </Text>
        </View>
      )}

      {/* Files List */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : filteredFiles.length === 0 ? (
        <View className="flex-1 justify-center items-center p-6">
          <Feather name="file" size={48} color="#CBD5E1" />
          <Text className="text-slate-500 font-bold text-sm mt-3">
            {currentFolderId === null ? t("files.empty_channel") : t("files.empty_folder")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View className="bg-white border border-slate-100 rounded-2xl p-4 mb-3 flex-row items-center justify-between shadow-xs">
              <TouchableOpacity
                onPress={() => {
                  if (item.isFolder) {
                    setCurrentFolderId(item._id);
                  } else {
                    handleOpenFile(item);
                  }
                }}
                className="flex-row items-center flex-1 mr-3"
              >
                <View className="w-10 h-10 rounded-xl bg-slate-100 justify-center items-center mr-3">
                  <Feather
                    name={item.isFolder ? "folder" : getFileIcon(item.mimeType, item.fileName)}
                    size={20}
                    color={item.isFolder ? "#D97706" : "#475569"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="font-bold text-slate-800 text-sm"
                    numberOfLines={1}
                  >
                    {item.isPinned && "📌 "}{item.fileName}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-1">
                    {item.isFolder ? t("files.folder_label") : formatDate(item.createdAt)} • {item.uploadedByName}
                  </Text>
                </View>
              </TouchableOpacity>

              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => {
                    if (item.isFolder) {
                      handleDownloadFolder(item);
                    } else {
                      handleDownload(item);
                    }
                  }}
                  className="p-2 mr-1"
                >
                  <Feather name="download" size={18} color="#64748B" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedFileForMenu(item);
                    setShowMenuModal(true);
                  }}
                  className="p-2"
                >
                  <Feather name="more-vertical" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* File Action Menu Bottom Sheet / Modal */}
      {selectedFileForMenu && (
        <Modal
          visible={showMenuModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMenuModal(false)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/40 justify-end"
            activeOpacity={1}
            onPress={() => setShowMenuModal(false)}
          >
            <View className="bg-white rounded-t-3xl p-5 pb-8">
              <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-5" />

              <Text className="font-bold text-slate-800 text-base mb-4 px-2 text-center" numberOfLines={1}>
                {selectedFileForMenu.isFolder ? t("files.action_folder") : t("files.action_file")}
              </Text>



              <TouchableOpacity
                onPress={() => {
                  setShowMenuModal(false);
                  selectedFileForMenu.isPinned ? handleUnpin(selectedFileForMenu) : handlePin(selectedFileForMenu);
                }}
                className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
              >
                <Ionicons name="pin" size={18} color="#475569" />
                <Text className="ml-3 font-semibold text-slate-700 text-sm">
                  {selectedFileForMenu.isPinned ? t("files.action_unpin") : t("files.action_pin")}
                </Text>
              </TouchableOpacity>

              {/* ẨN HOÀN TOÀN ĐỔI TÊN & XÓA KHỎI MENU NẾU LÀ MEMBER */}
              {canManageFiles && (
                <>
                  <View className="h-px bg-slate-100 my-1" />

                  <TouchableOpacity
                    onPress={() => {
                      setNewNameInput(selectedFileForMenu.fileName);
                      setShowRenameModal(true);
                    }}
                    className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
                  >
                    <Feather name="edit-2" size={18} color="#475569" />
                    <Text className="ml-3 font-semibold text-slate-700 text-sm">{t("files.action_rename")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      handleDelete(selectedFileForMenu);
                    }}
                    className="flex-row items-center py-3.5 px-2 active:bg-red-50 rounded-xl"
                  >
                    <Feather name="trash-2" size={18} color="#EF4444" />
                    <Text className="ml-3 font-semibold text-red-600 text-sm">{t("files.action_delete")}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Rename Dialog Modal */}
      {showRenameModal && selectedFileForMenu && (
        <Modal
          visible={showRenameModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRenameModal(false)}
        >
          <View className="flex-1 bg-black/50 justify-center items-center p-6">
            <View className="bg-white rounded-2xl w-full p-5">
              <Text className="font-bold text-slate-800 text-base mb-3">{t("files.rename_title")}</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 mb-4"
                value={newNameInput}
                onChangeText={setNewNameInput}
                placeholder={t("files.rename_placeholder")}
              />
              <View className="flex-row justify-end gap-2">
                <TouchableOpacity
                  onPress={() => setShowRenameModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-slate-200"
                >
                  <Text className="text-slate-600 font-semibold text-sm">{t("files.btn_cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRename}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 active:bg-blue-700"
                >
                  <Text className="text-white font-semibold text-sm">{t("files.btn_rename")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* File Preview Modal */}
      {isPreviewVisible && previewFile && previewUrl && (
        <Modal
          visible={isPreviewVisible}
          transparent={false}
          animationType="slide"
          onRequestClose={() => {
            setIsPreviewVisible(false);
            setPreviewFile(null);
            setPreviewUrl(null);
          }}
        >
          <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "bottom"]}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            {/* Header */}
            <View className="bg-slate-900 px-4 py-4 flex-row items-center justify-between border-b border-slate-800">
              <TouchableOpacity
                onPress={() => {
                  setIsPreviewVisible(false);
                  setPreviewFile(null);
                  setPreviewUrl(null);
                }}
                className="p-2"
              >
                <Feather name="arrow-left" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text className="text-white font-bold text-base flex-1 ml-3 truncate" numberOfLines={1}>
                {previewFile.fileName}
              </Text>
              <TouchableOpacity
                onPress={() => handleDownload(previewFile)}
                className="p-2"
              >
                <Feather name="download" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Content Container */}
            <View className="flex-1 items-center justify-center bg-slate-950">
              {renderPreviewContent(previewFile, previewUrl)}
            </View>
          </SafeAreaView>
        </Modal>
      )}
      {/* ===== Upload Action Menu Bottom Sheet ===== */}
      <Modal
        visible={showUploadMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadMenu(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-end"
          activeOpacity={1}
          onPress={() => setShowUploadMenu(false)}
        >
          <View className="bg-white rounded-t-3xl p-5 pb-10">
            <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-5" />
            <Text className="font-bold text-slate-800 text-base mb-4 px-2">
              {t("files.upload_menu_title")}
            </Text>

            {/* 1. Tạo thư mục rỗng */}
            <TouchableOpacity
              onPress={() => {
                setShowUploadMenu(false);
                setNewFolderName("");
                setIsCreateFolderModalOpen(true);
              }}
              className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
            >
              <View className="w-9 h-9 rounded-xl bg-amber-50 items-center justify-center mr-3">
                <Feather name="folder-plus" size={18} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-800 text-sm">{t("files.upload_menu_folder")}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{t("files.upload_menu_folder_desc")}</Text>
              </View>
            </TouchableOpacity>

            <View className="h-px bg-slate-100 my-1" />

            {/* 2. Upload tệp */}
            <TouchableOpacity
              onPress={() => {
                setShowUploadMenu(false);
                handlePickAndUpload();
              }}
              className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
            >
              <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center mr-3">
                <Feather name="file" size={18} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-800 text-sm">{t("files.upload_menu_file")}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{t("files.upload_menu_file_desc")}</Text>
              </View>
            </TouchableOpacity>

            <View className="h-px bg-slate-100 my-1" />

            {/* 3. Upload hình ảnh và video */}
            <TouchableOpacity
              onPress={() => {
                setShowUploadMenu(false);
                handlePickAndUploadMedia();
              }}
              className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
            >
              <View className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center mr-3">
                <Feather name="image" size={18} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-800 text-sm">{t("files.upload_menu_media")}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{t("files.upload_menu_media_desc")}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== Create Folder Modal ===== */}
      <Modal
        visible={isCreateFolderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateFolderModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-6">
          <View className="bg-white rounded-2xl w-full p-5">
            <Text className="font-bold text-slate-800 text-base mb-1">{t("files.create_folder_title")}</Text>
            {currentFolderId !== null && (
              <Text className="text-xs text-slate-400 mb-3">
                {t("files.create_folder_sub_desc", { name: files.find((f: any) => f._id === currentFolderId)?.fileName || t("files.default_folder_name") })}
              </Text>
            )}
            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 mb-4 mt-2"
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={t("files.create_folder_placeholder")}
              autoFocus
              onSubmitEditing={handleCreateFolder}
            />
            <View className="flex-row justify-end gap-2">
              <TouchableOpacity
                onPress={() => {
                  setIsCreateFolderModalOpen(false);
                  setNewFolderName("");
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-slate-200"
              >
                <Text className="text-slate-600 font-semibold text-sm">{t("files.btn_cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 active:bg-blue-700 disabled:opacity-50"
              >
                {isCreatingFolder ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-semibold text-sm">{t("files.btn_create")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
