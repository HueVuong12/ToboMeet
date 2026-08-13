import { useState, useEffect } from "react";

/**
 * Hook kiểm tra xem ứng dụng có đang chạy bên trong môi trường Electron hay không.
 */
export function useIsElectron() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Kiểm tra xem đối tượng electronAPI (được inject từ preload.js) có tồn tại không
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setIsElectron(true);
    }
  }, []);

  return isElectron;
}
