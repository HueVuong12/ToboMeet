import { useState, useEffect } from "react";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { toast } from "sonner";
import {
  useToggleMeetingChatMutation,
  useToggleWaitingRoomStatusMutation,
} from "@/lib/redux/api/meetingsApi";

export function useRoomSettings({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string;
  channelId: string;
  meetingCode: string;
}) {
  const { localParticipant } = useLocalParticipant();
  const { metadata: roomMetadata } = useRoomInfo();

  const [toggleChatApi] = useToggleMeetingChatMutation();
  const [toggleWaitingRoomApi] = useToggleWaitingRoomStatusMutation(); // API bật/tắt phòng chờ

  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [isWaitingRoomEnabled, setIsWaitingRoomEnabled] = useState(false); // Mặc định tắt phòng chờ

  // Kiểm tra quyền Chủ phòng/Admin
  let isHost = false;
  try {
    if (localParticipant?.metadata) {
      const userMeta = JSON.parse(localParticipant.metadata);
      isHost =
        userMeta.hasAdminPowers === true ||
        userMeta.role === "owner" ||
        userMeta.role === "admin";
    }
  } catch (e) {}

  // Lắng nghe và đồng bộ trạng thái cài đặt chung từ Server (Metadata của LiveKit)
  useEffect(() => {
    if (!roomMetadata) return;
    try {
      const meta = JSON.parse(roomMetadata);
      if (typeof meta.isChatEnabled === "boolean") {
        setIsChatEnabled(meta.isChatEnabled);
      }
      if (typeof meta.isWaitingRoomEnabled === "boolean") {
        setIsWaitingRoomEnabled(meta.isWaitingRoomEnabled);
      }
    } catch (e) {}
  }, [roomMetadata]);

  const canChat = isChatEnabled || isHost;

  // Toggle Chat
  const handleToggleChat = async () => {
    const newState = !isChatEnabled;
    setIsChatEnabled(newState); // Optimistic UI

    try {
      await toggleChatApi({
        roomId,
        channelId,
        meetingCode,
        isChatEnabled: newState,
      }).unwrap();
    } catch (error: any) {
      if (error?.code === 4032 || error?.status === 403) {
        toast.error("Bạn không đủ quyền thực hiện chức năng này");
      } else toast.error("Chưa thể thực hiện thao tác này");
      setIsChatEnabled(!newState); // Rollback nếu lỗi
    }
  };

  // Toggle Phòng chờ
  const handleToggleWaitingRoom = async () => {
    const newState = !isWaitingRoomEnabled;
    setIsWaitingRoomEnabled(newState); // Optimistic UI

    try {
      await toggleWaitingRoomApi({
        roomId,
        channelId,
        meetingCode,
        isWaitingRoomEnabled: newState,
      }).unwrap();
    } catch (error: any) {
      if (error?.code === 4032 || error?.status === 403) {
        toast.error("Bạn không đủ quyền thực hiện chức năng này");
      } else toast.error("Chưa thể thực hiện thao tác này");
      setIsWaitingRoomEnabled(!newState); // Rollback nếu lỗi
    }
  };

  return {
    isChatEnabled,
    canChat,
    isWaitingRoomEnabled,
    isHost,
    handleToggleChat,
    handleToggleWaitingRoom,
  };
}
