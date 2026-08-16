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
  Clipboard,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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
import * as Sharing from "expo-sharing";

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

  // Search & Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);

  // Rename & Options State
  const [selectedFileForMenu, setSelectedFileForMenu] = useState<ChannelFileResponse | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Format File Size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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
      Alert.alert("Lỗi", "Bạn không có quyền tải tệp lên");
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
        Alert.alert("Lỗi", "Chỉ hỗ trợ file dưới 50MB!");
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
        throw new Error("Lỗi khi đẩy file lên cloud");
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

      Alert.alert("Thành công", "Tải tệp lên thành công");
      refetch();
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert("Lỗi", errorObj?.data?.message || errorObj?.message || "Tải tệp lên thất bại.");
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
        Alert.alert("Lỗi", "Không thể mở liên kết tải xuống trên thiết bị này.");
      }
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert("Lỗi", errorObj?.data?.message || "Không thể lấy liên kết tải xuống.");
    }
  };

  // Tải xuống thư mục dưới dạng ZIP (Mobile)
  const handleDownloadFolder = async (file: ChannelFileResponse) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://dolphin-paternity-estrogen.ngrok-free.dev/api";
      const downloadUrl = `${API_BASE_URL}/channel-files/${file._id}/download-folder`;
      const localUri = `${FileSystem.documentDirectory}${file.fileName}.zip`;

      Alert.alert("Tải xuống", "Đang chuẩn bị tải xuống thư mục...");

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri, {
        headers,
      });

      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: "application/zip",
            dialogTitle: `Tải xuống ${file.fileName}.zip`,
          });
        } else {
          Alert.alert("Thành công", `Thư mục đã được tải xuống và lưu tại: ${downloadResult.uri}`);
        }
      } else {
        throw new Error(`Mã lỗi tải xuống: ${downloadResult.status}`);
      }
    } catch (err) {
      console.error("Mobile download folder error:", err);
      Alert.alert("Lỗi", "Không thể tải xuống thư mục. Vui lòng thử lại.");
    }
  };

  // Copy Link
  const handleCopyLink = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: false }).unwrap();
      if (Clipboard?.setString) {
        Clipboard.setString(res.downloadUrl);
      } else {
        await Linking.openURL(res.downloadUrl);
      }
      Alert.alert("Thành công", "Đã sao chép liên kết tải xuống tệp (hiệu lực 60s)");
    } catch {
      Alert.alert("Lỗi", "Không thể sao chép liên kết.");
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
      Alert.alert("Thành công", "Đã đổi tên tệp thành công");
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      Alert.alert("Lỗi", errorObj?.data?.message || "Đổi tên tệp thất bại.");
    }
  };

  // Delete File
  const handleDelete = (file: ChannelFileResponse) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa tệp "${file.fileName}"? Hành động này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteFile({ fileId: file._id, channelId }).unwrap();
              setShowMenuModal(false);
              refetch();
              Alert.alert("Thành công", "Xóa tệp thành công");
            } catch (err) {
              const errorObj = err as { data?: { message?: string }; message?: string };
              Alert.alert("Lỗi", errorObj?.data?.message || "Xóa tệp thất bại.");
            }
          },
        },
      ],
    );
  };

  // Ghim tệp/thư mục
  const handlePin = async (file: ChannelFileResponse) => {
    try {
      await pinFile({ fileId: file._id, channelId }).unwrap();
      Alert.alert("Thành công", "Đã ghim tệp/thư mục thành công");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.data?.message || "Không thể ghim tệp/thư mục.");
    }
  };

  // Bỏ ghim tệp/thư mục
  const handleUnpin = async (file: ChannelFileResponse) => {
    try {
      await unpinFile({ fileId: file._id, channelId }).unwrap();
      Alert.alert("Thành công", "Đã bỏ ghim tệp/thư mục thành công");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.data?.message || "Không thể bỏ ghim tệp/thư mục.");
    }
  };

  // Filter & Sort
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

    // Sắp xếp các mục chưa ghim theo tiêu chí bình thường
    unpinned.sort((a: ChannelFileResponse, b: ChannelFileResponse) => {
      if (sortBy === "name") {
        return sortOrder === "asc"
          ? a.fileName.localeCompare(b.fileName)
          : b.fileName.localeCompare(a.fileName);
      }
      if (sortBy === "size") {
        return sortOrder === "asc"
          ? a.fileSize - b.fileSize
          : b.fileSize - a.fileSize;
      }
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return [...pinned, ...unpinned];
  }, [files, searchTerm, sortBy, sortOrder, currentFolderId]);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Action Bar (Search & Upload) */}
      <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-2">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            placeholder="Tìm kiếm tệp..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="flex-1 ml-2 text-sm text-slate-800 focus:outline-none"
          />
        </View>

        {/* Chỉ hiển thị nút Upload với Owner / Admin */}
        {canManageFiles && (
          <TouchableOpacity
            onPress={handlePickAndUpload}
            disabled={isUploading}
            className="w-10 h-10 bg-blue-600 rounded-xl items-center justify-center active:opacity-80 disabled:opacity-50"
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="upload" size={18} color="#ffffff" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Sort options bar */}
      <View className="px-4 py-2 flex-row items-center justify-between border-b border-slate-100 bg-white">
        <View className="flex-row items-center gap-3">
          <Text className="text-xs text-slate-500">Sắp xếp theo:</Text>
          <TouchableOpacity
            onPress={() => {
              if (sortBy === "date") {
                setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
              } else {
                setSortBy("date");
                setSortOrder("desc");
              }
            }}
            className={`px-2 py-1 rounded-md ${sortBy === "date" ? "bg-blue-50" : ""}`}
          >
            <Text className={`text-xs font-bold ${sortBy === "date" ? "text-blue-600" : "text-slate-600"}`}>
              Ngày {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (sortBy === "name") {
                setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
              } else {
                setSortBy("name");
                setSortOrder("asc");
              }
            }}
            className={`px-2 py-1 rounded-md ${sortBy === "name" ? "bg-blue-50" : ""}`}
          >
            <Text className={`text-xs font-bold ${sortBy === "name" ? "text-blue-600" : "text-slate-600"}`}>
              Tên {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-slate-400">
          Tổng số: {filteredFiles.length} tệp
        </Text>
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
            <Text className="text-sm font-bold text-blue-600">Quay lại</Text>
          </TouchableOpacity>
          <View className="w-px h-4 bg-slate-200 mx-3" />
          <Text className="text-sm text-slate-500 font-semibold truncate flex-1">
            {files.find((f: any) => f._id === currentFolderId)?.fileName || "Thư mục"}
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
            {currentFolderId === null ? "Chưa có tệp nào trong kênh" : "Thư mục này trống"}
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
                    handleDownload(item);
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
                    {item.isFolder ? "Thư mục" : formatFileSize(item.fileSize)} • {item.uploadedByName}
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

              <Text className="font-bold text-slate-800 text-base mb-4 px-2" numberOfLines={1}>
                {selectedFileForMenu.fileName}
              </Text>

              {!selectedFileForMenu.isFolder && (
                <TouchableOpacity
                  onPress={() => {
                    setShowMenuModal(false);
                    handleCopyLink(selectedFileForMenu);
                  }}
                  className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
                >
                  <Feather name="copy" size={18} color="#475569" />
                  <Text className="ml-3 font-semibold text-slate-700 text-sm">Sao chép liên kết</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  setShowMenuModal(false);
                  selectedFileForMenu.isPinned ? handleUnpin(selectedFileForMenu) : handlePin(selectedFileForMenu);
                }}
                className="flex-row items-center py-3.5 px-2 active:bg-slate-50 rounded-xl"
              >
                <Ionicons name="pin" size={18} color="#475569" />
                <Text className="ml-3 font-semibold text-slate-700 text-sm">
                  {selectedFileForMenu.isPinned ? "Bỏ ghim" : "Ghim"}
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
                    <Text className="ml-3 font-semibold text-slate-700 text-sm">Đổi tên</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      handleDelete(selectedFileForMenu);
                    }}
                    className="flex-row items-center py-3.5 px-2 active:bg-red-50 rounded-xl"
                  >
                    <Feather name="trash-2" size={18} color="#EF4444" />
                    <Text className="ml-3 font-semibold text-red-600 text-sm">Xóa</Text>
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
              <Text className="font-bold text-slate-800 text-base mb-3">Đổi tên tệp</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 mb-4"
                value={newNameInput}
                onChangeText={setNewNameInput}
                placeholder="Nhập tên mới..."
              />
              <View className="flex-row justify-end gap-2">
                <TouchableOpacity
                  onPress={() => setShowRenameModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 active:bg-slate-200"
                >
                  <Text className="text-slate-600 font-semibold text-sm">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRename}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 active:bg-blue-700"
                >
                  <Text className="text-white font-semibold text-sm">Đổi tên</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
