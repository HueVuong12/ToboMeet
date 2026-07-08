"use client";

import { useEffect, createContext, useContext } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";

const EventContext = createContext<any>(null);

export function EventProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!userId) return;

    // 1. Đảm bảo Socket luôn kết nối
    if (!socket.connected) {
      socket.connect();
    }

    // LUÔN JOIN LẠI PHÒNG KHI CÓ KẾT NỐI MỚI/RECONNECT
    const handleConnect = () => {
      socket.emit("join_user_room", userId);
    };

    if (socket.connected) {
      handleConnect();
    }

    // Lắng nghe mỗi khi mạng chập chờn hoặc server restart xong
    socket.on("connect", handleConnect);

    const handleSwitchRequested = (data: {
      userId: string;
      channelId: string;
      roomId: string;
      requesterSocketId: string;
    }) => {
      const activeChannel = localStorage.getItem(
        `active_meeting_${data.roomId}`,
      );

      if (activeChannel === data.channelId) {
        toast("Thiết bị khác đang yêu cầu chuyển cuộc họp.", {
          duration: 10000,
          action: {
            label: "Cho phép",
            onClick: () => {
              // 1. Xóa cờ ở thiết bị này
              localStorage.removeItem(`active_meeting_${data.roomId}`);

              // 2. Bắn một CustomEvent để Component RoomContent (nếu đang bật) tự động đóng Popup
              window.dispatchEvent(
                new CustomEvent("FORCE_CLOSE_MEETING_WINDOW", {
                  detail: data.roomId,
                }),
              );

              // 3. Báo lại cho máy kia là đã nhả phòng
              socket.emit("accept_switch_device", {
                ...data,
                targetSocketId: data.requesterSocketId, // Đẩy ID của Máy B lên Server
              });
              toast.success("Đã chuyển cuộc họp sang thiết bị kia.");
            },
          },
        });
      }
    };

    socket.on("switch_device_requested", handleSwitchRequested);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("switch_device_requested", handleSwitchRequested);
    };
  }, [userId]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
