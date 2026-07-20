// hooks/socket/useNotificationSocketEvents.ts
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useRoomCacheManager } from "../useRoomCacheManager";

export function useNotificationSocketEvents() {
  const router = useRouter();
  const { removeRoomFromMyList } = useRoomCacheManager();

  useEffect(() => {
    const handleNotifications = (notifications: any[]) => {
      const currentPath = window.location.pathname;
      if (!notifications || notifications.length === 0) return;

      notifications.forEach((notif, index) => {
        const roomId = notif.metadata?.roomId;
        const isCurrentlyInRoom = currentPath.includes(`/room/${roomId}`);

        setTimeout(() => {
          switch (notif.type) {
            case "KICKED": {
              if (roomId) removeRoomFromMyList(roomId); // dọn cache rtk query

              toast.info("Thông báo hệ thống", {
                description: `Bạn đã bị kick khỏi ${notif.metadata?.roomName || ""}.`,
                duration: 8000,
              });

              // Dọn dẹp storage và đóng cửa sổ meeting
              localStorage.removeItem(`active_meeting_${roomId}`);
              window.dispatchEvent(
                new CustomEvent("FORCE_CLOSE_MEETING_WINDOW", {
                  detail: roomId,
                }),
              );

              if (isCurrentlyInRoom) {
                // Nếu đang trong phòng bị kick thì tự động văng ra ngoài
                setTimeout(() => {
                  router.push("/dashboard");
                }, 1500);
              }
              break;
            }

            case "ROOM_DISBANDED": {
              if (roomId) removeRoomFromMyList(roomId);

              toast.info("Phòng giải tán", {
                description: `Trưởng nhóm đã giải tán ${notif.metadata?.roomName || ""}.`,
                duration: 8000,
              });

              if (isCurrentlyInRoom) {
                setTimeout(() => {
                  router.push("/dashboard");
                }, 1500);
              }
              break;
            }

            default:
              console.warn(
                "Chưa hỗ trợ hiển thị loại thông báo này:",
                notif.type,
              );
          }
        }, index * 500);
      });

      const notifIds = notifications.map((n) => n._id);
      socket.emit("mark_notifications_read", notifIds); // ack lại cho server biết đã nhận rồi
    };

    socket.on("receive_notifications", handleNotifications);

    return () => {
      socket.off("receive_notifications", handleNotifications);
    };
  }, []);
}
