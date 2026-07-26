// hooks/useDeviceId.ts (Dành cho Web)
import { useState, useEffect } from "react";

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // Đảm bảo code chỉ chạy trên môi trường Browser (Client-side)
    if (typeof window === "undefined") return;

    const DEVICE_KEY = "tobo_web_device_id";
    let storedId = localStorage.getItem(DEVICE_KEY);

    if (!storedId) {
      // Ưu tiên dùng Crypto API của trình duyệt để tạo UUID chuẩn
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        storedId = crypto.randomUUID();
      } else {
        // Fallback an toàn nếu trình duyệt cũ
        storedId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      localStorage.setItem(DEVICE_KEY, storedId);
    }

    setDeviceId(storedId);
  }, []);

  return deviceId;
}
