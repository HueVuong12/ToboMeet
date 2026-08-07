// components/providers/GlobalSocketListeners.tsx
"use client";

import { useNotificationSocketEvents } from "../hooks/socket/useNotificationSocketEvents";
import { useForceLogoutSocket } from "../hooks/socket/useForceLogoutSocket";

// Lắng nghe các sự kiện toàn cục (tất cả mọi trang)
export function GlobalSocketListeners() {
  // Đăng ký toàn bộ các module lắng nghe sự kiện tại đây
  useNotificationSocketEvents();
  useForceLogoutSocket(); // Xử lý khi bị đăng xuất từ thiết bị khác

  return null; // Component này không render UI
}
