// components/providers/EventProvider.tsx
"use client";

import { useEffect, createContext, useContext, useRef } from "react";
import { socket } from "@/lib/socket";
import { createClient } from "@/lib/supabase/client";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { roomsApi } from "@/lib/redux/api/roomsApi";
import { AppDispatch } from "@/lib/redux/store";

const EventContext = createContext<any>(null);

export function EventProvider({
  userId: initialUserId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    let activeUserId = initialUserId;

    const joinUserRoom = (uid: string) => {
      socket.emit("join_user_room", uid);
      hasJoinedRef.current = true;
    };

    const setupSocket = async () => {
      if (!activeUserId) {
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          activeUserId = session?.user?.id;
        } catch {}
      }

      if (!activeUserId) return;

      // Đăng ký handler TRƯỚC khi connect để tránh race condition
      const handleConnect = () => {
        if (activeUserId) {
          joinUserRoom(activeUserId);
        }
      };

      const handleDisconnect = () => {
        hasJoinedRef.current = false;
      };

      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);

      // Nếu socket đã connected → emit join ngay, không chờ event "connect"
      if (socket.connected) {
        if (!hasJoinedRef.current) {
          joinUserRoom(activeUserId);
        }
      } else {
        socket.connect();
      }

      // Lắng nghe sự kiện khi chính mình được thêm vào phòng mới
      const handleUserRoomAdded = (data: any) => {
        if (!data) return;
        // Invalidate RTK Query cache để danh sách phòng trên Dashboard / Sidebar tự động cập nhật
        dispatch(roomsApi.util.invalidateTags(["Room"]));
        toast.info(
          `Bạn vừa được thêm vào phòng "${data.room?.name || "mới"}"`,
        );
      };

      socket.on("user_room_added", handleUserRoomAdded);

      return () => {
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("user_room_added", handleUserRoomAdded);
      };
    };

    let cleanup: (() => void) | void;
    setupSocket().then((fn) => { cleanup = fn; });

    // Lắng nghe sự kiện Auth state change để tự động join room khi đăng nhập
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        activeUserId = session.user.id;
        if (socket.connected) {
          joinUserRoom(activeUserId);
        } else {
          socket.connect();
        }
      }
    });

    return () => {
      if (cleanup) cleanup();
      subscription.unsubscribe();
    };
  }, [initialUserId, dispatch]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
