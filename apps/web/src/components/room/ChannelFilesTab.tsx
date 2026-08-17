"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  useGetChannelFilesQuery,
  useCreateSignedUploadUrlMutation,
  useSaveFileMetaMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
  useLazyGetDownloadUrlQuery,
  usePinFileMutation,
  useUnpinFileMutation,
} from "@/lib/redux/api/channelFilesApi";
import { ChannelFileResponse } from "@tobomeet/shared/types";
import {
  Upload,
  FolderPlus,
  FolderOpen,
  Folder,
  Search,
  ArrowUpDown,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  File as FileIcon,
  MoreVertical,
  Download,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface ChannelFilesTabProps {
  roomId: string;
  channelId: string;
  userId: string;
  canManageFiles: boolean; // True nếu là Owner hoặc Admin (Phó nhóm)
}

export default function ChannelFilesTab({
  roomId,
  channelId,
  userId,
  canManageFiles,
}: ChannelFilesTabProps) {
  const t = useTranslations("room");
  const { data: filesData = [], isLoading, refetch } = useGetChannelFilesQuery({
    roomId,
    channelId,
  });
  const files = filesData as any[];

  const [createSignedUploadUrl] = useCreateSignedUploadUrlMutation();
  const [saveFileMeta] = useSaveFileMetaMutation();
  const [renameFile] = useRenameFileMutation();
  const [deleteFile] = useDeleteFileMutation();
  const [triggerDownload] = useLazyGetDownloadUrlQuery();
  const [pinFile] = usePinFileMutation();
  const [unpinFile] = useUnpinFileMutation();

  // Search & Filter & Sort state
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Modal / Dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [fileToRename, setFileToRename] = useState<ChannelFileResponse | null>(null);
  const [newNameInput, setNewNameInput] = useState("");
  const [fileToDelete, setFileToDelete] = useState<ChannelFileResponse | null>(null);

  // Create Folder Modal state
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Upload Dropdown State
  const locale = useLocale();
  const [isUploadDropdownOpen, setIsUploadDropdownOpen] = useState(false);
  const uploadDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close upload dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        uploadDropdownRef.current &&
        !uploadDropdownRef.current.contains(e.target as Node)
      ) {
        setIsUploadDropdownOpen(false);
      }
    };
    if (isUploadDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUploadDropdownOpen]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Helper cho Icon loại tệp
  const getFileIcon = (mimeType: string, fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return <FileImage className="w-5 h-5 text-purple-500" />;
    }
    if (mimeType.startsWith("video/") || ["mp4", "mkv", "avi", "mov"].includes(ext)) {
      return <FileVideo className="w-5 h-5 text-rose-500" />;
    }
    if (mimeType.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(ext)) {
      return <FileAudio className="w-5 h-5 text-amber-500" />;
    }
    if (mimeType.includes("pdf") || ext === "pdf") {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      ["xls", "xlsx", "csv"].includes(ext)
    ) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (
      mimeType.includes("word") ||
      mimeType.includes("document") ||
      ["doc", "docx"].includes(ext)
    ) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (["js", "ts", "jsx", "tsx", "html", "css", "json"].includes(ext)) {
      return <FileCode className="w-5 h-5 text-cyan-500" />;
    }
    return <FileIcon className="w-5 h-5 text-slate-400" />;
  };

  // Format Dung lượng file
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Format Ngày tháng
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle File Upload
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!canManageFiles) {
      toast.error(t("files_no_permission_upload"));
      return;
    }

    const file = fileList[0];
    const fileName = file.name;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatusText(t("files_uploading"));

      // 1. Tạo Signed Upload URL
      const { signedUrl, storagePath, publicUrl } = await createSignedUploadUrl({
        roomId,
        channelId,
        fileName,
      }).unwrap();

      // 2. Upload file trực tiếp lên Supabase storage qua axios (bypass proxy)
      await axios.put(signedUrl, file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || file.size),
          );
          setUploadProgress(percentCompleted);
        },
      });

      // 3. Lưu Metadata
      await saveFileMeta({
        roomId,
        channelId,
        fileName,
        storagePath,
        publicUrl,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        parentFolderId: currentFolderId,
      }).unwrap();

      toast.success(t("files_upload_success"));
    } catch (err: any) {
      toast.error(
        err?.data?.message || err?.message || t("files_upload_failed"),
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Folder Upload
  const handleFolderUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!canManageFiles) {
      toast.error(t("files_no_permission_folder"));
      return;
    }

    const filesArray = Array.from(fileList);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusText(t("files_uploading"));

    try {
      // Nhóm các thư mục cần tạo trước
      const foldersToCreate = new Set<string>();
      filesArray.forEach((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        const parts = relativePath.split("/");
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            const folderPath = parts.slice(0, i).join("/");
            foldersToCreate.add(folderPath);
          }
        }
      });

      // Bản đồ map: Đường dẫn thư mục -> ID thư mục trong DB
      const folderPathToIdMap: Record<string, string> = {};

      const sortedFolders = Array.from(foldersToCreate).sort(
        (a, b) => a.split("/").length - b.split("/").length,
      );

      for (const folderPath of sortedFolders) {
        const parts = folderPath.split("/");
        const folderName = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");
        const parentFolderId =
          parentPath === "" ? currentFolderId : folderPathToIdMap[parentPath];

        // Tạo meta thư mục
        const res = await saveFileMeta({
          roomId,
          channelId,
          fileName: folderName,
          isFolder: true,
          parentFolderId,
        }).unwrap();

        folderPathToIdMap[folderPath] = res._id;
      }

      // Upload file
      const totalFiles = filesArray.length;
      for (let index = 0; index < totalFiles; index++) {
        const file = filesArray[index];
        const relativePath = file.webkitRelativePath || file.name;
        const parts = relativePath.split("/");
        const fileName = file.name;
        const parentPath = parts.slice(0, -1).join("/");
        const parentFolderId =
          parentPath === "" ? currentFolderId : folderPathToIdMap[parentPath];

        setUploadStatusText(`Tải lên tệp ${index + 1}/${totalFiles}...`);
        setUploadProgress(Math.round((index / totalFiles) * 100));

        // 1. Tạo Signed Upload URL
        const resUrl = await createSignedUploadUrl({
          roomId,
          channelId,
          fileName,
        }).unwrap();

        // 2. Upload file vật lý
        await axios.put(resUrl.signedUrl, file, {
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        // 3. Lưu meta file
        await saveFileMeta({
          roomId,
          channelId,
          fileName: fileName,
          storagePath: resUrl.storagePath,
          publicUrl: resUrl.publicUrl,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          parentFolderId,
        }).unwrap();
      }

      toast.success(t("files_folder_upload_success"));
    } catch (err: any) {
      toast.error(
        err?.data?.message || err?.message || t("files_folder_upload_failed"),
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText("");
      if (folderInputRef.current) folderInputRef.current.value = "";
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
      toast.success(locale === "vi" ? "Tạo thư mục thành công" : "Folder created successfully");
      setIsCreateFolderModalOpen(false);
      setNewFolderName("");
    } catch (err: any) {
      toast.error(err?.data?.message || (locale === "vi" ? "Tạo thư mục thất bại" : "Failed to create folder"));
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Download File qua Signed Download URL (Hết hạn 60s)
  const handleDownload = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: true }).unwrap();
      const link = document.createElement("a");
      link.href = res.downloadUrl;
      link.download = res.fileName || file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể tải xuống tệp.");
    }
  };

  // Tải xuống thư mục dưới dạng ZIP
  const handleDownloadFolder = async (file: ChannelFileResponse) => {
    const toastId = toast.loading(t("files_download_folder_preparing"));
    try {
      const response = await axios.get(`/api/channel-files/${file._id}/download-folder`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/zip" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `${file.fileName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t("files_download_folder_success"), { id: toastId });
    } catch (err: any) {
      console.error("Download folder error:", err);
      toast.error(t("files_download_folder_failed"), { id: toastId });
    }
  };

  // Ghim tệp/thư mục
  const handlePin = async (file: ChannelFileResponse) => {
    try {
      await pinFile({ fileId: file._id, channelId }).unwrap();
      toast.success(t("files_pin_success"));
    } catch (err: any) {
      toast.error(err?.data?.message || t("files_pin_failed"));
    }
  };

  // Bỏ ghim tệp/thư mục
  const handleUnpin = async (file: ChannelFileResponse) => {
    try {
      await unpinFile({ fileId: file._id, channelId }).unwrap();
      toast.success(t("files_unpin_success"));
    } catch (err: any) {
      toast.error(err?.data?.message || t("files_unpin_failed"));
    }
  };

  // Preview File
  const handlePreview = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: false }).unwrap();
      window.open(res.downloadUrl, "_blank");
    } catch (err: any) {
      toast.error(err?.data?.message || t("files_action_preview"));
    }
  };

  // Copy Link
  const handleCopyLink = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: false }).unwrap();
      await navigator.clipboard.writeText(res.downloadUrl);
      toast.success(t("files_copy_link_success"));
    } catch (err) {
      toast.error(t("files_copy_link_failed"));
    }
  };

  // Rename File
  const handleRenameSubmit = async () => {
    if (!fileToRename || !newNameInput.trim()) return;
    try {
      await renameFile({
        fileId: fileToRename._id,
        newName: newNameInput.trim(),
        channelId,
      }).unwrap();
      toast.success(t("files_rename_success"));
      setFileToRename(null);
    } catch (err: any) {
      toast.error(err?.data?.message || t("files_rename_failed"));
    }
  };

  // Delete File
  const handleDeleteSubmit = async () => {
    if (!fileToDelete) return;
    try {
      await deleteFile({ fileId: fileToDelete._id, channelId }).unwrap();
      toast.success(t("files_delete_success"));
      setFileToDelete(null);
    } catch (err: any) {
      toast.error(err?.data?.message || t("files_delete_failed"));
    }
  };

  // Lọc và Sắp xếp danh sách file
  const filteredFiles = useMemo(() => {
    let result = [...files];
    if (searchTerm.trim() !== "") {
      result = files.filter((f) =>
        f.fileName.toLowerCase().includes(searchTerm.toLowerCase().trim()),
      );
    } else {
      result = files.filter((f) => (f.parentFolderId || null) === currentFolderId);
    }

    // Tách riêng danh sách đã ghim và chưa ghim
    const pinned = result.filter((f) => f.isPinned);
    const unpinned = result.filter((f) => !f.isPinned);

    // Ghim trước lên trước (sắp xếp tăng dần theo pinnedAt)
    pinned.sort((a, b) => {
      const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return timeA - timeB;
    });

    // Sắp xếp các mục chưa ghim theo tiêu chí bình thường
    unpinned.sort((a, b) => {
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
      // 'date'
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return [...pinned, ...unpinned];
  }, [files, searchTerm, sortBy, sortOrder, currentFolderId]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = files.find((f) => f._id === currentId && f.isFolder);
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parentFolderId || null;
      } else {
        break;
      }
    }
    return crumbs;
  }, [files, currentFolderId]);

  return (
    <div
      className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden"
      onDragOver={(e) => {
        if (!canManageFiles) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!canManageFiles) return;
        e.preventDefault();
        setIsDragOver(false);
        handleFileUpload(e.dataTransfer.files);
      }}
    >
      {/* Visual Overlay khi Drag & Drop */}
      {isDragOver && canManageFiles && (
        <div className="absolute inset-0 z-30 bg-brand-500/10 border-2 border-dashed border-brand-500 rounded-lg flex flex-col items-center justify-center backdrop-blur-xs pointer-events-none">
          <Upload className="w-12 h-12 text-brand-600 animate-bounce mb-2" />
          <p className="text-base font-bold text-brand-700">
            {t("files_empty_desc")}
          </p>
        </div>
      )}

      {/* Toolbar / Action Bar Header */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Left Actions: Search Bar */}
        <div className="flex items-center gap-2 flex-1 min-w-60">
          <div className="relative flex-1 max-w-md flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder={t("files_search_placeholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>
            
            {/* Nút tìm kiếm thay thế cho cụm sắp xếp cũ */}
            <button
              onClick={handleSearch}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              title="Tìm kiếm"
            >
              <Search size={16} />
              <span>Tìm kiếm</span>
            </button>
          </div>
        </div>

        {/* Right Actions: Upload & New Folder buttons (ẨN HOÀN TOÀN với Member) */}
        {canManageFiles && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            <input
              type="file"
              ref={folderInputRef}
              {...{ webkitdirectory: "", directory: "" }}
              multiple
              onChange={(e) => handleFolderUpload(e.target.files)}
              className="hidden"
            />
            <div className="relative" ref={uploadDropdownRef}>
              <button
                disabled={isUploading}
                onClick={() => setIsUploadDropdownOpen(!isUploadDropdownOpen)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                <span>{locale === "vi" ? "Tạo hoặc tải lên" : "Create or upload"}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isUploadDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isUploadDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  {/* Mục 1: Tạo thư mục rỗng */}
                  <button
                    onClick={() => {
                      setIsUploadDropdownOpen(false);
                      setNewFolderName("");
                      setIsCreateFolderModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                  >
                    <FolderPlus size={14} className="text-amber-500" />
                    <span>{locale === "vi" ? "Thư mục" : "New folder"}</span>
                  </button>

                  {/* Divider */}
                  <div className="my-1 border-t border-slate-100" />

                  {/* Mục 2: Tải tệp lên */}
                  <button
                    onClick={() => {
                      setIsUploadDropdownOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                  >
                    <Upload size={14} className="text-slate-400" />
                    <span>{locale === "vi" ? "Tải tệp lên" : "Upload file"}</span>
                  </button>

                  {/* Mục 3: Tải thư mục lên */}
                  <button
                    onClick={() => {
                      setIsUploadDropdownOpen(false);
                      folderInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium"
                  >
                    <FolderOpen size={14} className="text-slate-400" />
                    <span>{locale === "vi" ? "Tải thư mục lên" : "Upload folder"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar khi Upload */}
      {isUploading && (
        <div className="w-full bg-brand-50 border-b border-brand-100 px-4 py-2 flex items-center justify-between text-xs text-brand-700 font-medium animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-brand-600" />
            <span>{uploadStatusText} {uploadProgress}%</span>
          </div>
          <div className="w-32 bg-brand-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-brand-600 h-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Files Table / List */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 px-1 font-semibold flex-wrap">
          <button
            onClick={() => setCurrentFolderId(null)}
            className="hover:text-brand-600 font-bold transition-colors text-slate-600"
          >
            {t("files")}
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb._id} className="flex items-center gap-1.5">
              <ChevronRight size={12} className="text-slate-400" />
              <button
                onClick={() => setCurrentFolderId(crumb._id)}
                className="hover:text-brand-600 font-bold transition-colors text-slate-600 max-w-40 truncate"
              >
                {crumb.fileName}
              </button>
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : filteredFiles.length === 0 && currentFolderId === null ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
            <FileIcon className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
            <p className="font-medium text-slate-500">{t("files_empty")}</p>
            {canManageFiles && (
              <p className="text-xs text-slate-400 mt-1">
                {t("files_empty_desc")}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{t("files_header_name")}</th>
                  <th className="py-3 px-4 hidden sm:table-cell">{t("files_header_uploader")}</th>
                  <th className="py-3 px-4 hidden md:table-cell">{t("files_header_date")}</th>
                  <th className="py-3 pl-4 pr-14 text-right">{t("files_header_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">


                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs font-medium">
                      {t("files_folder_empty")}
                    </td>
                  </tr>
                )}

                {filteredFiles.map((file) => (
                  <tr
                    key={file._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* File Name & Icon */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 p-2 bg-slate-100 rounded-lg">
                          {file.isFolder ? (
                            <Folder className="w-5 h-5 text-amber-500 fill-amber-100" />
                          ) : (
                            getFileIcon(file.mimeType, file.fileName)
                          )}
                        </div>
                        <div className="min-w-0">
                          {file.isFolder ? (
                            <button
                              onClick={() => setCurrentFolderId(file._id)}
                              className="font-bold text-slate-800 hover:text-brand-600 text-sm truncate max-w-xs sm:max-w-md text-left block focus:outline-none transition-colors"
                              title={file.fileName}
                            >
                              {file.isPinned && <span className="mr-1">📌</span>}
                              {file.fileName}
                            </button>
                          ) : (
                            <p
                              onClick={() => handlePreview(file)}
                              className="font-medium text-slate-800 hover:text-brand-600 cursor-pointer truncate max-w-xs sm:max-w-md transition-colors"
                              title={file.fileName}
                            >
                              {file.isPinned && <span className="mr-1">📌</span>}
                              {file.fileName}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 sm:hidden">
                            {file.isFolder ? t("files_folder") : formatFileSize(file.fileSize)} • {file.uploadedByName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Uploader */}
                    <td className="py-3 px-4 hidden sm:table-cell text-slate-600 text-xs">
                      {file.uploadedByName}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 hidden md:table-cell text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(file.createdAt)}
                    </td>



                    {/* Actions Menu */}
                    <td className={`py-3 pl-4 pr-14 text-right relative ${activeMenuId === file._id ? "z-10" : ""}`}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => file.isFolder ? handleDownloadFolder(file) : handleDownload(file)}
                          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                          title={t("files_action_download")}
                        >
                          <Download size={16} />
                        </button>

                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuId(
                                activeMenuId === file._id ? null : file._id,
                              )
                            }
                            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {/* Dropdown Menu */}
                          {activeMenuId === file._id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveMenuId(null)}
                              />
                              <div className="absolute right-0 top-8 z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-left animate-fade-in">
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      file.isPinned ? handleUnpin(file) : handlePin(file);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <span className="text-sm">📌</span> {file.isPinned ? t("files_action_unpin") : t("files_action_pin")}
                                  </button>


                                {/* ẨN HOÀN TOÀN ĐỔI TÊN / XÓA NẾU LÀ MEMBER */}
                                {canManageFiles && (
                                  <>
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setFileToRename(file);
                                        setNewNameInput(file.fileName);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Edit2 size={14} /> {t("files_action_rename")}
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setFileToDelete(file);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> {t("files_action_delete")}
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Đổi Tên */}
      {fileToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {t("files_rename_title")}
              </h3>
              <button
                onClick={() => setFileToRename(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder={t("files_rename_label")}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 mb-5"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFileToRename(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl"
              >
                {t("files_action_rename")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo Thư Mục Mới */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {locale === "vi" ? "Tạo thư mục mới" : "New folder"}
              </h3>
              <button
                onClick={() => {
                  setIsCreateFolderModalOpen(false);
                  setNewFolderName("");
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  handleCreateFolder();
                }
              }}
              placeholder={locale === "vi" ? "Nhập tên thư mục" : "Folder name"}
              autoFocus
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 mb-5"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreateFolderModalOpen(false);
                  setNewFolderName("");
                }}
                disabled={isCreatingFolder}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
              >
                {locale === "vi" ? "Huỷ" : "Cancel"}
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || isCreatingFolder}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCreatingFolder && <Loader2 size={14} className="animate-spin" />}
                {locale === "vi" ? "Tạo thư mục" : "Create folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa File */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-800 mb-2">
              {t("files_delete_title")}
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              {t("files_delete_confirm")}
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl"
              >
                {t("files_delete_action")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
