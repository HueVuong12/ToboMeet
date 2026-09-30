// hooks/socket/useNotificationSocketEvents.ts
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { NotificationResponse } from "@tobomeet/shared/types";
import { useNotificationCacheManager } from "../useNotificationCacheManager";

import { useDispatch } from "react-redux";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { usersApi } from "@/lib/redux/api/usersApi";
import { AppDispatch } from "@/lib/redux/store";

export function useNotificationSocketEvents() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { removeRoomFromMyList } = useRoomCacheManager();
  const { addNotificationsToCache, updateUnreadNotificationBadge } =
    useNotificationCacheManager();

  useEffect(() => {
    const handleNotifications = (notifications: NotificationResponse[]) => {
      const currentPath = window.location.pathname;
      if (!notifications || notifications.length === 0) return;

      // Cập nhật cache ngay lập tức để hiện lên drawer thông báo
      addNotificationsToCache(notifications);

      // Cập nhật badge unread của người dùng
      updateUnreadNotificationBadge(true);

      notifications.forEach((notif, index) => {
        const roomId = notif.metadata?.roomId;
        const isCurrentlyInRoom = currentPath.includes(`/room/${roomId}`);
        const canPopup = notif.canPopup;

        // Bỏ qua những thông báo không cho popup
        if (!canPopup) return;

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

            case "PARTICIPANT_REMOVED": {
              const meetingCode = notif.metadata?.meetingCode;
              toast.error(`Bạn đã bị xoá khỏi cuộc họp ${meetingCode}.`);
              break;
            }

            case "CALENDAR_INVITE": {
              const title =
                notif.metadata?.title || notif.metadata?.eventTitle || "";
              const inviter = notif.metadata?.inviterName || "Ai đó";
              toast.info("Lời mời lịch họp", {
                description: `${inviter} đã mời bạn tham gia cuộc họp "${title}".`,
                duration: 8000,
              });
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
      socket.emit("mark_notifications_notified", notifIds); // ack lại cho server biết đã popup rồi
    };

    const handleNotificationDeleted = () => {
      dispatch(notificationsApi.util.invalidateTags(["Notification"]));
      dispatch(usersApi.util.invalidateTags(["User"]));
    };

    socket.on("receive_notifications", handleNotifications);
    socket.on("notification_deleted", handleNotificationDeleted);

    return () => {
      socket.off("receive_notifications", handleNotifications);
      socket.off("notification_deleted", handleNotificationDeleted);
    };
  }, [dispatch]);
}

