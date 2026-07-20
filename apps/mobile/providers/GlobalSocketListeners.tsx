// components/providers/GlobalSocketListeners.tsx
"use client";

import { useMeetingSocketEvents } from "../hooks/socket/useMeetingSocketEvents";
import { useNotificationSocketEvents } from "../hooks/socket/useNotificationSocketEvents";

// Lắng nghe các sự kiện toàn cục (tất cả mọi trang)
export function GlobalSocketListeners() {
  // Đăng ký toàn bộ các module lắng nghe sự kiện tại đây
  useMeetingSocketEvents();
  useNotificationSocketEvents();

  return null; // Component này không render UI
}
