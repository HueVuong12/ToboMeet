// hooks/useSocket.ts
"use client";

import { useMemo } from "react";
import { getSocket, AppSocket } from "@/lib/socket";

/**
 * Hook trả về Socket instance tương ứng với môi trường:
 * - Nếu đang chạy trong Electron Desktop: Sử dụng Socket.IO từ Main Process qua IPC
 * - Nếu đang chạy trên Web Browser: Sử dụng socket.io-client trực tiếp từ Web
 */
export function useSocket(): AppSocket {
  return useMemo(() => getSocket(), []);
}

export type { AppSocket };
