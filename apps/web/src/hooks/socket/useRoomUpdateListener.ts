// hooks/socket/useRoomUpdateListener.ts
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRoomCacheManager } from "../useRoomCacheManager";

interface UseRoomUpdateListenerOptions {
  /** Callback khi user hiện tại vừa rời kênh thành công — để component switch sang kênh khác */
  onUserLeftChannel?: (channelId: string) => void;
}

export function useRoomUpdateListener(
  roomId: string,
  userId: string,
  options?: UseRoomUpdateListenerOptions,
) {
  const router = useRouter();
  const t = useTranslations("room");

  const {
    removeMemberFromRoomCache,
    addMemberToRoomCache,
    invalidateRoomList,
    invalidateRoom,
  } = useRoomCacheManager();

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
          break;

        case "member_left":
          // Cập nhật realtime khi có thành viên chủ động rời phòng
          removeMemberFromRoomCache(data.roomId, data.leftUserId);
          invalidateRoom(roomId);
          invalidateRoomList();
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
          invalidateRoom(roomId);
          if (data.newOwnerId === userId) {
            toast.success(
              t("toast_transfer_new_owner", {
                role: "Leader",
                defaultValue:
                  "Bạn đã trở thành Quản lý / Trưởng nhóm mới của phòng!",
              }),
            );
          } else if (data.previousOwnerId !== userId) {
            toast.info(
              t("toast_transfer_info", {
                defaultValue: "Quyền quản lý phòng vừa được chuyển giao.",
              }),
            );
          }
          break;

        case "channel_member_removed":
          invalidateRoomList();
          invalidateRoom(roomId);
          if (data.targetUserId === userId) {
            toast.warning(
              t("toast_remove_from_private_channel_warning", {
                defaultValue: "Bạn không còn quyền truy cập kênh riêng tư này.",
              }),
            );
          }
          break;

        case "channel_member_left":
          // Cập nhật cache phòng để sidebar tự loại bỏ kênh đã rời
          invalidateRoom(roomId);
          invalidateRoomList();

          if (data.userId === userId) {
            // Chính user vừa rời kênh → callback để component switch sang kênh khác
            if (options?.onUserLeftChannel) {
              options.onUserLeftChannel(data.channelId);
            }
            toast.success(
              t("toast_leave_channel_success", {
                defaultValue: "Bạn đã rời khỏi kênh thành công.",
              }),
            );
          }
          break;

        case "member_role_updated":
          invalidateRoomList();
          invalidateRoom(roomId);
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
  }, [
    roomId,
    userId,
    router,
    removeMemberFromRoomCache,
    addMemberToRoomCache,
    options?.onUserLeftChannel,
  ]);
}
