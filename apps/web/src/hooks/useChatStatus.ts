import { useState, useEffect } from "react";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { toast } from "sonner";
import { useToggleMeetingChatMutation } from "@/lib/redux/api/meetingsApi";

export function useChatStatus({
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

  const [isChatEnabled, setIsChatEnabled] = useState(true);

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

  // Lắng nghe và đồng bộ trạng thái chat từ Server
  useEffect(() => {
    if (!roomMetadata) return;
    try {
      const meta = JSON.parse(roomMetadata);
      if (typeof meta.isChatEnabled === "boolean") {
        setIsChatEnabled(meta.isChatEnabled);
      }
    } catch (e) {}
  }, [roomMetadata]);

  const canChat = isChatEnabled || isHost;

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

      if (!newState) toast.error("Đã khoá chat.");
      else toast.success("Đã mở chat.");
    } catch (error: any) {
      if (error?.code === 4032) {
        toast.error("Bạn không đủ quyền thực hiện chức năng này");
      } else toast.error("Chưa thể thực hiện thao tác này");
      setIsChatEnabled(!newState); // Rollback nếu lỗi
    }
  };

  return { isChatEnabled, canChat, isHost, handleToggleChat };
}
