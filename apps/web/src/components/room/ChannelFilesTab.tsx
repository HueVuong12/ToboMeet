"use client";

import { useState, useRef, useMemo } from "react";
import {
  useGetChannelFilesQuery,
  useCreateSignedUploadUrlMutation,
  useSaveFileMetaMutation,
  useRenameFileMutation,
  useDeleteFileMutation,
  useLazyGetDownloadUrlQuery,
} from "@/lib/redux/api/channelFilesApi";
import { ChannelFileResponse } from "@tobomeet/shared/types";
import {
  Upload,
  FolderPlus,
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
  const { data: files = [], isLoading, refetch } = useGetChannelFilesQuery({
    roomId,
    channelId,
  });

  const [createSignedUploadUrl] = useCreateSignedUploadUrlMutation();
  const [saveFileMeta] = useSaveFileMetaMutation();
  const [renameFile] = useRenameFileMutation();
  const [deleteFile] = useDeleteFileMutation();
  const [triggerDownload] = useLazyGetDownloadUrlQuery();

  // Search & Filter & Sort state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Modal / Dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [fileToRename, setFileToRename] = useState<ChannelFileResponse | null>(null);
  const [newNameInput, setNewNameInput] = useState("");
  const [fileToDelete, setFileToDelete] = useState<ChannelFileResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle Upload File (Nhiều tệp)
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!canManageFiles) {
      toast.error("Bạn không có quyền tải tệp lên");
      return;
    }

    const filesArray = Array.from(fileList);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];

        // 1. Lấy Signed Upload URL
        const res = await createSignedUploadUrl({
          roomId,
          channelId,
          fileName: file.name,
        }).unwrap();

        // 2. Upload trực tiếp qua Signed URL
        await axios.put(res.signedUrl, file, {
          headers: { "Content-Type": file.type || "application/octet-stream" },
          onUploadProgress: (evt) => {
            if (evt.total) {
              const currentFilePercent = (evt.loaded / evt.total) * 100;
              const totalPercent = Math.round(
                ((i + currentFilePercent / 100) / filesArray.length) * 100,
              );
              setUploadProgress(totalPercent);
            }
          },
        });

        // 3. Báo Backend lưu metadata vào DB
        await saveFileMeta({
          roomId,
          channelId,
          fileName: file.name,
          storagePath: res.storagePath,
          publicUrl: res.publicUrl,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }).unwrap();
      }

      toast.success(
        filesArray.length === 1
          ? "Đã tải tệp lên thành công"
          : `Đã tải ${filesArray.length} tệp lên thành công`,
      );
    } catch (err: any) {
      toast.error(
        err?.data?.message || err?.message || "Tải tệp lên thất bại.",
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  // Preview File
  const handlePreview = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: false }).unwrap();
      window.open(res.downloadUrl, "_blank");
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể xem trước tệp.");
    }
  };

  // Copy Link
  const handleCopyLink = async (file: ChannelFileResponse) => {
    try {
      const res = await triggerDownload({ fileId: file._id, download: false }).unwrap();
      await navigator.clipboard.writeText(res.downloadUrl);
      toast.success("Đã sao chép liên kết tệp (có hiệu lực trong 60s)");
    } catch (err) {
      toast.error("Không thể sao chép liên kết.");
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
      toast.success("Đã đổi tên tệp thành công");
      setFileToRename(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Đổi tên thất bại.");
    }
  };

  // Delete File
  const handleDeleteSubmit = async () => {
    if (!fileToDelete) return;
    try {
      await deleteFile({ fileId: fileToDelete._id, channelId }).unwrap();
      toast.success("Đã xóa tệp thành công");
      setFileToDelete(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Xóa tệp thất bại.");
    }
  };

  // Lọc và Sắp xếp danh sách file
  const filteredFiles = useMemo(() => {
    let result = files.filter((f) =>
      f.fileName.toLowerCase().includes(searchTerm.toLowerCase().trim()),
    );

    result.sort((a, b) => {
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

    return result;
  }, [files, searchTerm, sortBy, sortOrder]);

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
            Thả tệp vào đây để tải lên
          </p>
        </div>
      )}

      {/* Toolbar / Action Bar Header */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Left Actions: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 min-w-60">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Tìm kiếm tệp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
            <ArrowUpDown size={14} className="text-slate-500" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="date">Mới nhất</option>
              <option value="name">Tên (A-Z)</option>
              <option value="size">Dung lượng</option>
            </select>
            <button
              onClick={() =>
                setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              className="p-1 hover:bg-slate-200 rounded text-xs font-bold text-slate-600"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
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
            <button
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              <span>Tải tệp lên</span>
            </button>

            <button
              onClick={() =>
                toast.info("Tính năng Thư mục mới sẽ được hỗ trợ trong tương lai.")
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 transition-colors"
            >
              <FolderPlus size={16} />
              <span className="hidden sm:inline">Thư mục mới</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar khi Upload */}
      {isUploading && (
        <div className="w-full bg-brand-50 border-b border-brand-100 px-4 py-2 flex items-center justify-between text-xs text-brand-700 font-medium animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-brand-600" />
            <span>Đang tải tệp lên... {uploadProgress}%</span>
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
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
            <FileIcon className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
            <p className="font-medium text-slate-500">Chưa có tệp nào trong kênh</p>
            {canManageFiles && (
              <p className="text-xs text-slate-400 mt-1">
                Kéo thả tệp vào đây hoặc bấm "Tải tệp lên" để bắt đầu.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Tên tệp</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Người tải lên</th>
                  <th className="py-3 px-4 hidden md:table-cell">Ngày tải</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Dung lượng</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredFiles.map((file) => (
                  <tr
                    key={file._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* File Name & Icon */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 p-2 bg-slate-100 rounded-lg">
                          {getFileIcon(file.mimeType, file.fileName)}
                        </div>
                        <div className="min-w-0">
                          <p
                            onClick={() => handlePreview(file)}
                            className="font-medium text-slate-800 hover:text-brand-600 cursor-pointer truncate max-w-xs sm:max-w-md transition-colors"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </p>
                          <p className="text-xs text-slate-400 sm:hidden">
                            {formatFileSize(file.fileSize)} • {file.uploadedByName}
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

                    {/* File Size */}
                    <td className="py-3 px-4 hidden sm:table-cell text-slate-500 text-xs whitespace-nowrap">
                      {formatFileSize(file.fileSize)}
                    </td>

                    {/* Actions Menu */}
                    <td className={`py-3 px-4 text-right relative ${activeMenuId === file._id ? "z-10" : ""}`}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition-colors"
                          title="Tải xuống"
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
                                    handleCopyLink(file);
                                  }}
                                  className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Copy size={14} /> Sao chép liên kết
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
                                      <Edit2 size={14} /> Đổi tên
                                    </button>

                                    <button
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setFileToDelete(file);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> Xóa tệp
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
                Đổi tên tệp
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
              placeholder="Nhập tên mới..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 mb-5"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFileToRename(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl"
              >
                Lưu thay đổi
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
              Xác nhận xóa tệp
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              Bạn có chắc chắn muốn xóa tệp{" "}
              <strong className="text-slate-900">{fileToDelete.fileName}</strong>? Hành
              động này không thể hoàn tác.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl"
              >
                Xóa tệp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
