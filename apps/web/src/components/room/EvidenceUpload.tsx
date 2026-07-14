"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  UploadCloud,
  X,
  AlertCircle,
  FileImage,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  uploadReportEvidence,
  UploadResponse,
} from "@/services/uploadService";

interface EvidenceUploadProps {
  onChange: (
    evidences: { url: string; fileName: string; fileSize: number }[]
  ) => void;
  onUploadingChange: (isUploading: boolean) => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  url?: string;
  errorMsg?: string;
}

export default function EvidenceUpload({
  onChange,
  onUploadingChange,
}: EvidenceUploadProps) {
  const t = useTranslations("room");
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cập nhật trạng thái loading lên component cha
  useEffect(() => {
    const isUploading = files.some((f) => f.status === "uploading");
    onUploadingChange(isUploading);
  }, [files, onUploadingChange]);

  // Cập nhật danh sách URL đã upload thành công lên component cha
  useEffect(() => {
    const uploaded = files
      .filter((f) => f.status === "success" && f.url)
      .map((f) => ({
        url: f.url!,
        fileName: f.file.name,
        fileSize: f.file.size,
      }));
    onChange(uploaded);
  }, [files, onChange]);

  // Validate một file đơn lẻ
  const validateFile = (file: File): string | null => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return t("report_evidence_error_file_type", { fileName: file.name });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return t("report_evidence_error_file_size", { fileName: file.name });
    }

    return null;
  };

  // Bắt đầu upload 1 file
  const startUpload = async (fileObj: UploadingFile) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileObj.id
          ? { ...f, status: "uploading", progress: 0, errorMsg: undefined }
          : f
      )
    );

    try {
      const response: UploadResponse = await uploadReportEvidence(
        fileObj.file,
        (progress) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileObj.id ? { ...f, progress } : f))
          );
        }
      );

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "success", progress: 100, url: response.url }
            : f
        )
      );
    } catch (err: any) {
      console.error("[EvidenceUpload] Upload error:", err);
      const errorMsg =
        err?.message ||
        t("report_evidence_error_upload_failed", { fileName: fileObj.file.name });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id ? { ...f, status: "error", errorMsg } : f
        )
      );
    }
  };

  // Xử lý các file được lựa chọn (qua input hoặc drag-drop)
  const handleFiles = (newFiles: FileList) => {
    setLocalError(null);

    // Kiểm tra tổng số lượng file sau khi cộng thêm các file mới
    const currentSuccessOrUploadingCount = files.length;
    if (currentSuccessOrUploadingCount + newFiles.length > 5) {
      setLocalError(t("report_evidence_error_max_files"));
      return;
    }

    const fileObjectsToAdd: UploadingFile[] = [];

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const error = validateFile(file);

      if (error) {
        setLocalError(error);
        return; // Dừng lại và hiển thị lỗi nếu có file sai định dạng hoặc quá dung lượng
      }

      const fileObj: UploadingFile = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        progress: 0,
        status: "uploading",
      };

      fileObjectsToAdd.push(fileObj);
    }

    setFiles((prev) => [...prev, ...fileObjectsToAdd]);

    // Bắt đầu upload bất đồng bộ cho từng file
    fileObjectsToAdd.forEach((fileObj) => {
      startUpload(fileObj);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRetryUpload = (fileObj: UploadingFile) => {
    startUpload(fileObj);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        {t("report_evidence_label")}
      </label>

      {/* Drag & Drop Area */}
      {files.length < 5 && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200 ${
            dragActive
              ? "border-brand-500 bg-brand-50/30 scale-[0.99]"
              : "border-slate-300 hover:border-brand-400 hover:bg-slate-50/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
          />
          <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-700 text-center">
            {t("report_evidence_drag_drop")}
          </p>
          <p className="text-xs text-slate-400 mt-1 text-center">
            {t("report_evidence_hint")}
          </p>
        </div>
      )}

      {/* Local Validation Error */}
      {localError && (
        <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}

      {/* Preview & Status List */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((fileObj) => {
            const objectUrl = URL.createObjectURL(fileObj.file);

            return (
              <div
                key={fileObj.id}
                className="relative group border border-slate-200 rounded-xl overflow-hidden aspect-square bg-slate-50 flex flex-col justify-between p-2"
              >
                {/* Image Preview / Icon */}
                <div className="absolute inset-0 w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={objectUrl}
                    alt={fileObj.file.name}
                    className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                    onLoad={() => URL.revokeObjectURL(objectUrl)}
                  />
                </div>

                {/* Overlays / Progress state */}
                <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2 text-white text-xs opacity-100 transition-opacity duration-200">
                  {fileObj.status === "uploading" && (
                    <div className="space-y-1.5 w-full">
                      <div className="flex justify-between font-medium">
                        <span className="truncate max-w-[70%]">
                          {t("report_evidence_uploading")}
                        </span>
                        <span>{fileObj.progress}%</span>
                      </div>
                      <div className="w-full bg-white/30 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-brand-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${fileObj.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {fileObj.status === "error" && (
                    <div className="flex flex-col items-center justify-center h-full gap-1.5 text-center">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                      <button
                        type="button"
                        onClick={() => handleRetryUpload(fileObj)}
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Tải lại
                      </button>
                    </div>
                  )}

                  {fileObj.status === "success" && (
                    <div className="absolute top-2 left-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 h-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  title="Xóa ảnh"
                  onClick={() => handleRemoveFile(fileObj.id)}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-white text-gray-400 hover:bg-red-500 hover:text-white rounded-full transition-all duration-200 shadow-md border border-gray-100 z-20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
