// hooks/socket/useRoomUpdateListener.ts
import { useEffect } from "react";
import { Alert } from "react-native";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { socket } from "../../lib/socket";
import { toast } from "../../lib/toast";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../lib/redux/store";
import { channelFilesApi } from "../../lib/redux/api/channelFilesApi";

interface UseRoomUpdateListenerOptions {
  onUserLeftChannel?: (channelId: string) => void;
}

export function useRoomUpdateListener(
  roomId: string,
  userId?: string,
  options?: UseRoomUpdateListenerOptions,
) {
  const router = useRouter();
  const { t } = useTranslation();

  const {
    removeMemberFromRoomCache,
    addMemberToRoomCache,
    updateRoomDetailsCache,
    invalidateRoomList,
    invalidateRoom,
  } = useRoomCacheManager();
  const dispatch = useDispatch<AppDispatch>();

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

    const handleRoomUpdated = (data: {
      type: string;
      roomId: string;
      removedUserId?: string;
      roomName?: string;
      name?: string;
      room?: { name: string };
      leftUserId?: string;
      member?: { displayName: string };
      newOwnerId?: string;
      previousOwnerId?: string;
      targetUserId?: string;
      userId?: string;
      channelId?: string;
    }) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case "room_renamed":
          if (data.name) {
            updateRoomDetailsCache(data.roomId, { name: data.name });
          }
          invalidateRoomList();
          break;

        case "channel_renamed":
          invalidateRoom(data.roomId);
          invalidateRoomList();
          break;


        case "member_removed":
          // Xóa thành viên khỏi danh sách hiển thị
          if (data.removedUserId) {
            removeMemberFromRoomCache(data.roomId, data.removedUserId);
          }
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

        case "member_left":
          // Cập nhật realtime khi có thành viên chủ động rời phòng
          if (data.leftUserId) {
            removeMemberFromRoomCache(data.roomId, data.leftUserId);
          }
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
            Alert.alert(
              t("common.notification", { defaultValue: "Thông báo" }),
              t("room.toast_transfer_new_owner", {
                role: "Leader",
                defaultValue: "🎉 Bạn đã trở thành Quản lý / Trưởng nhóm mới của phòng!",
              }),
            );
          } else if (data.previousOwnerId !== userId) {
            toast.info(
              t("room.toast_transfer_info", {
                defaultValue: "Quyền quản lý phòng vừa được chuyển giao.",
              }),
            );
          }
          break;

        case "member_role_updated":
          invalidateRoomList();
          invalidateRoom(roomId);
          break;

        case "channel_member_removed":
          invalidateRoomList();
          invalidateRoom(roomId);
          if (data.targetUserId === userId) {
            toast.info(
              t("room.toast_remove_from_private_channel_warning", {
                defaultValue: "Bạn không còn quyền truy cập kênh riêng tư này.",
              }),
            );
          }
          break;

        case "channel_member_left":
          invalidateRoomList();
          invalidateRoom(roomId);

          if (data.userId === userId) {
            if (options?.onUserLeftChannel && data.channelId) {
              options.onUserLeftChannel(data.channelId);
            }
            toast.success("Bạn đã rời khỏi kênh thành công.");
          }
          break;

        case "channel_file_uploaded":
        case "channel_file_renamed":
        case "channel_file_deleted":
        case "channel_file_pinned":
        case "channel_file_unpinned":
          if (data.channelId) {
            dispatch(
              channelFilesApi.util.invalidateTags([
                { type: "ChannelFile", id: data.channelId },
              ])
            );
          }
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
