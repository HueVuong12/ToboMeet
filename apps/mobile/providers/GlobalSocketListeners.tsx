// components/providers/GlobalSocketListeners.tsx
"use client";

import { useNotificationSocketEvents } from "../hooks/socket/useNotificationSocketEvents";

// Lắng nghe các sự kiện toàn cục (tất cả mọi trang)
export function GlobalSocketListeners() {
  // Đăng ký toàn bộ các module lắng nghe sự kiện tại đây
  useNotificationSocketEvents();

  return null; // Component này không render UI
}
