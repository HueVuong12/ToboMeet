// hooks/socket/useNotificationSocketEvents.ts
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";

export function useNotificationSocketEvents() {
  useEffect(() => {
    const handleNotifications = (notifications: any[]) => {
      if (!notifications || notifications.length === 0) return;

      notifications.forEach((notif, index) => {
        setTimeout(() => {
          // PHIÊN DỊCH TYPE THÀNH THÔNG BÁO TẠI FRONTEND
          switch (notif.type) {
            case "KICKED":
              toast.info("Thông báo hệ thống", {
                description: `Bạn đã bị kick khỏi ${notif.metadata?.roomName || ""}.`,
                duration: 8000,
              });
              // setTimeout(() => {
              //   window.location.href = "/dashboard";
              // }, 1500);
              break;

            case "ROOM_DISBANDED":
              toast.info("Phòng giải tán", {
                description: `Trưởng nhóm đã giải tán phòng ${notif.metadata?.roomName || ""}.`,
                duration: 8000,
              });
              window.dispatchEvent(
                new CustomEvent("FORCE_CLOSE_MEETING_WINDOW"),
              );
              break;

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
  }, []);
}
