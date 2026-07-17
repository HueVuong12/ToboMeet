// hooks/socket/useNotificationSocketEvents.ts
import { useEffect } from "react";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { useRouter, usePathname } from "expo-router";
import { toast } from "../../lib/toast";
import { socket } from "../../lib/socket";

export function useNotificationSocketEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const { removeRoomFromMyList } = useRoomCacheManager();

  // Lắng nghe và xử lý sự kiện thông báo
  useEffect(() => {
    const handleNotifications = (notifications: any[]) => {
      if (!notifications || notifications.length === 0) return;

      notifications.forEach((notif, index) => {
        const roomId = notif.metadata?.roomId;
        const isCurrentlyInRoom = pathname.includes(`/room/${roomId}`);

        setTimeout(() => {
          switch (notif.type) {
            case "KICKED": {
              if (roomId) removeRoomFromMyList(roomId);

              toast.info(
                `Bạn đã bị kick khỏi ${notif.metadata?.roomName || ""}.`,
              );

              if (isCurrentlyInRoom) {
                setTimeout(() => {
                  router.replace("/dashboard");
                }, 1500);
              }
              break;
            }

            case "ROOM_DISBANDED": {
              if (roomId) removeRoomFromMyList(roomId);

              toast.info(
                `Trưởng nhóm đã giải tán ${notif.metadata?.roomName || ""}.`,
              );

              if (isCurrentlyInRoom) {
                setTimeout(() => {
                  router.replace("/dashboard");
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
      socket.emit("mark_notifications_read", notifIds);
    };

    socket.on("receive_notifications", handleNotifications);

    return () => {
      socket.off("receive_notifications", handleNotifications);
    };
  }, [pathname, router, removeRoomFromMyList]);
}
