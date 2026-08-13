import { useState, useEffect, useCallback } from "react";

export interface MeetingConfig {
  recordingPath: string;
  recordingFormat: "webm" | "mp4";
  // Ví dụ tương lai:
  // autoSaveChat: boolean;
  // defaultTheme: "dark" | "light";
}

const DEFAULT_CONFIG: MeetingConfig = {
  recordingPath: "",
  recordingFormat: "webm",
};

export function useMeetingConfig() {
  const [config, setConfig] = useState<MeetingConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydration: Tải cấu hình từ localStorage khi Component render ở Client
  // Việc bọc trong useEffect giúp tránh lỗi Hydration Mismatch của Next.js (SSR)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPath = localStorage.getItem("recording_path") || "";
      const savedFormat =
        (localStorage.getItem("recording_format") as "webm" | "mp4") || "webm";

      setConfig({
        recordingPath: savedPath,
        recordingFormat: savedFormat,
      });
      setIsLoaded(true);
    }
  }, []);

  // Hàm cập nhật đường dẫn lưu video
  const updateRecordingPath = useCallback((path: string) => {
    setConfig((prev) => ({ ...prev, recordingPath: path }));
    if (typeof window !== "undefined") {
      localStorage.setItem("recording_path", path);
    }
  }, []);

  // Hàm cập nhật định dạng video
  const updateRecordingFormat = useCallback((format: "webm" | "mp4") => {
    setConfig((prev) => ({ ...prev, recordingFormat: format }));
    if (typeof window !== "undefined") {
      localStorage.setItem("recording_format", format);
    }
  }, []);

  return {
    config,
    isLoaded,
    updateRecordingPath,
    updateRecordingFormat,
  };
}
