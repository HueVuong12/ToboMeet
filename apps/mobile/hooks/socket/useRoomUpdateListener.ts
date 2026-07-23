// hooks/socket/useRoomUpdateListener.ts
import { useEffect } from "react";
import { Alert } from "react-native";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { socket } from "../../lib/socket";
import { toast } from "../../lib/toast";

export function useRoomUpdateListener(roomId: string, userId?: string) {
  const router = useRouter();
  const { t } = useTranslation();

  const { removeMemberFromRoomCache, addMemberToRoomCache, invalidateRoomList } =
    useRoomCacheManager();

  useEffect(() => {
    if (!roomId || !userId) return;

    // Đảm bảo kết nối socket
    if (!socket.connected) {
      socket.connect();
    }

    const joinRoomSocket = () => {
      socket.emit("join_room", roomId);
    };

    if (socket.connected) joinRoomSocket();
    socket.on("connect", joinRoomSocket);

    const handleRoomUpdated = (data: any) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case "member_removed":
          // Xóa thành viên khỏi danh sách hiển thị
          removeMemberFromRoomCache(data.roomId, data.removedUserId);
          if (data.removedUserId === userId) {
            const title = t("common.notification", { defaultValue: "Thông báo" });
            const roomName = data.roomName || data.room?.name || "phòng họp";
            const message = t("room.you_were_removed", {
              roomName,
              defaultValue: `Bạn đã bị xóa khỏi ${roomName}.`,
            });
            Alert.alert(title, message);
            router.replace("/dashboard");
          }
          break;

        case "member_joined":
          // Thêm người dùng mới vào cache để Sidebar hiển thị lập tức
          if (data.member) {
            addMemberToRoomCache(data.roomId, data.member);
            toast.success(`${data.member.displayName} vừa tham gia phòng`);
          }
          break;

        case "ownership_transferred":
          invalidateRoomList();
          if (data.newOwnerId === userId) {
            Alert.alert(
              t("common.notification", { defaultValue: "Thông báo" }),
              t("room.toast_transfer_new_owner", { role: "Leader", defaultValue: "🎉 Bạn đã trở thành Quản lý / Trưởng nhóm mới của phòng!" })
            );
          } else if (data.previousOwnerId !== userId) {
            toast.info(t("room.toast_transfer_info", { defaultValue: "Quyền quản lý phòng vừa được chuyển giao." }));
          }
          break;

        case "member_role_updated":
          invalidateRoomList();
          break;

        default:
          console.warn("Chưa xử lý sự kiện room_updated type:", data.type);
          break;
      }
    };

    socket.on("room_updated", handleRoomUpdated);

    return () => {
      socket.emit("leave_room", roomId);
      socket.off("connect", joinRoomSocket);
      socket.off("room_updated", handleRoomUpdated);
    };
  }, [roomId, userId, router, removeMemberFromRoomCache, addMemberToRoomCache]);
}
