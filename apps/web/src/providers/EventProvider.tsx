// components/providers/EventProvider.tsx
"use client";

import { useEffect, createContext, useContext, useRef } from "react";
import { socket } from "@/lib/socket";
import { createClient } from "@/lib/supabase/client";

const EventContext = createContext<any>(null);

export function EventProvider({
  userId: initialUserId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
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
  }, [initialUserId]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
