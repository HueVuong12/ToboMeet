import { axiosInstance } from "@/lib/axios";
import axios from "axios";

export interface UploadResponse {
  url: string;
  fileName: string;
  fileSize: number;
}

export const uploadReportEvidence = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  // Bước 1: Yêu cầu Backend cấp Signed Upload URL và Public URL tương lai
  const { signedUrl, url, fileName } = await axiosInstance.post<any, {
    signedUrl: string;
    url: string;
    fileName: string;
  }>("/uploads/report-evidence/signed-url", {
    fileName: file.name,
    mimeType: file.type,
  });

  // Bước 2: Upload tệp trực tiếp từ Frontend lên Supabase Storage qua Signed URL
  // Sử dụng thư viện axios gốc (không qua axiosInstance) để tránh bị ghi đè baseURL hoặc ảnh hưởng bởi interceptors
  await axios.put(signedUrl, file, {
    headers: {
      "Content-Type": file.type,
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  return {
    url,
    fileName,
    fileSize: file.size,
  };
};
