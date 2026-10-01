// hooks/socket/useNotificationSocketEvents.ts
import { useEffect } from "react";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { useRouter, usePathname } from "expo-router";
import { toast } from "../../lib/toast";
import { socket } from "../../lib/socket";
import { NotificationResponse } from "@tobomeet/shared/types";
import { useNotificationCacheManager } from "../useNotificationCacheManager";

export function useNotificationSocketEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const { removeRoomFromMyList } = useRoomCacheManager();
  const { addNotificationsToCache, updateUnreadNotificationBadge } =
    useNotificationCacheManager();

  // Lắng nghe và xử lý sự kiện thông báo
  useEffect(() => {
    const handleNotifications = (notifications: NotificationResponse[]) => {
      if (!notifications || notifications.length === 0) return;

      // Cập nhật cache ngay lập tức để hiện lên drawer thông báo
      addNotificationsToCache(notifications);

      // Cập nhật badge unread của người dùng
      updateUnreadNotificationBadge(true);

      notifications.forEach((notif, index) => {
        const roomId = notif.metadata?.roomId;
        const isCurrentlyInRoom = pathname.includes(`/room/${roomId}`);
        const canPopup = notif.canPopup;

        // Bỏ qua những thông báo không cho popup
        if (!canPopup) return;

        setTimeout(() => {
          switch (notif.type) {
            case "KICKED": {
              if (roomId) removeRoomFromMyList(roomId);

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

            case "CALENDAR_INVITE": {
              const title =
                notif.metadata?.title || notif.metadata?.eventTitle || "";
              const inviter = notif.metadata?.inviterName || "Ai đó";
              toast.info(
                `${inviter} đã mời bạn tham gia sự kiện "${title}".`,
              );
              break;
            }

            case "CALENDAR_START": {
              const title =
                notif.metadata?.title || notif.metadata?.eventTitle || "Sự kiện";
              toast.info(
                `Sự kiện "${title}" đã đến giờ bắt đầu!`,
              );
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
      socket.emit("mark_notifications_notified", notifIds);
    };

    socket.on("receive_notifications", handleNotifications);

    return () => {
      socket.off("receive_notifications", handleNotifications);
    };
  }, [pathname, router, removeRoomFromMyList]);
}
