// components/providers/EventProvider.tsx
"use client";

import { useEffect, createContext, useContext, useRef } from "react";
import { socket } from "@/lib/socket";

const EventContext = createContext<any>(null);

// KHÔNG ĐƯỢC SỬA FILE NÀY, NẾU CÓ THÊM THÌ TẠO HOOK MỚI TRONG hooks/socket
export function EventProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  // Chặn React Strict Mode chạy 2 lần
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const handleConnect = () => {
      socket.emit("join_user_room", userId);
      hasJoinedRef.current = true; // Đánh dấu là đã join trong phiên này
    };

    // Reset cờ khi người dùng THỰC SỰ bị rớt mạng
    const handleDisconnect = () => {
      hasJoinedRef.current = false;
    };

    if (socket.connected && !hasJoinedRef.current) {
      handleConnect();
    } else if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [userId]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
