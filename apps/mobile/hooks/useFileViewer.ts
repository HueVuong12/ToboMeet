import { useState, useCallback } from "react";

export interface FileViewerItem {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export type FileCategory = "image" | "pdf" | "office" | "other";

export function getFileCategory(file: FileViewerItem): FileCategory {
  const mime = (file.type || "").toLowerCase();
  const ext = (file.name || "").split(".").pop()?.toLowerCase() || "";

  // 1. Hình ảnh
  if (
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(ext)
  ) {
    return "image";
  }

  // 2. PDF
  if (mime.includes("pdf") || ext === "pdf") {
    return "pdf";
  }

  // 3. Văn bản & Bảng tính Office
  if (
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation") ||
    mime.includes("officedocument") ||
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"].includes(ext)
  ) {
    return "office";
  }

  // 4. Định dạng khác
  return "other";
}

export function useFileViewer() {
  const [selectedFile, setSelectedFile] = useState<FileViewerItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const openFile = useCallback((file: FileViewerItem) => {
    if (!file || !file.url) return;
    setSelectedFile(file);
    setIsVisible(true);
  }, []);

  const closeFile = useCallback(() => {
    setIsVisible(false);
    setSelectedFile(null);
  }, []);

  return {
    selectedFile,
    isVisible,
    openFile,
    closeFile,
  };
}
