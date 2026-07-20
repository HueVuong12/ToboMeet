// hooks/socket/useRoomUpdateListener.ts
import { useEffect } from "react";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { useRouter } from "expo-router";
import { socket } from "../../lib/socket";
import { toast } from "../../lib/toast";

export function useRoomUpdateListener(roomId: string, userId?: string) {
  const router = useRouter();

  const { removeMemberFromRoomCache, addMemberToRoomCache } =
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
          break;

        case "member_joined":
          // Thêm người dùng mới vào cache để Sidebar hiển thị lập tức
          if (data.member) {
            addMemberToRoomCache(data.roomId, data.member);
            toast.success(`${data.member.displayName} vừa tham gia phòng`);
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
  }, [roomId, userId, router, removeMemberFromRoomCache, addMemberToRoomCache]);
}
