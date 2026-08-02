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

      const handleConnect = () => {
        if (activeUserId) {
          socket.emit("join_user_room", activeUserId);
          hasJoinedRef.current = true;
        }
      };

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
        socket.off("user_room_added", handleUserRoomAdded);
      };
    };

    setupSocket();

    // Lắng nghe sự kiện Auth state change để tự động join room khi đăng nhập
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        activeUserId = session.user.id;
        if (socket.connected) {
          socket.emit("join_user_room", activeUserId);
          hasJoinedRef.current = true;
        } else {
          socket.connect();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialUserId, dispatch]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
