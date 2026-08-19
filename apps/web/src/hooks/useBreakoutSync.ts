import { useMeetingSessionContext } from "@/components/meeting/contexts/MeetingSessionContext";
import { useRoomContext } from "@livekit/components-react";
import { LivekitRoomMetadata } from "@tobomeet/shared/types";
import { RoomEvent } from "livekit-client";
import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useBreakoutSync() {
  const t = useTranslations("meeting.breakout_sync");
  const room = useRoomContext();
  const { handleSwitchToBreakout, handleReturnToMain } =
    useMeetingSessionContext();

  // Lắng nghe TẤT CẢ sự kiện Breakout: Đóng phòng (Metadata) và Bị kéo vào phòng (DataChannel)
  useEffect(() => {
    const handleMetadataChanged = (metadataStr: string | undefined) => {
      if (!metadataStr) return;
      try {
        const meta: LivekitRoomMetadata = JSON.parse(metadataStr);
        if (meta.roomType === "breakout" && meta.status === "closing") {
          toast.info(t("session_ended"));
          handleReturnToMain(room.name);
        }
      } catch (error) {
        console.error("Lỗi parse metadata breakout:", error);
      }
    };

    const handleDataReceived = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload);

      try {
        const data = JSON.parse(jsonString) as any;

        if (data.type === "SYSTEM" && data.command === "FORCE_JOIN_BREAKOUT") {
          const myIdentity = room.localParticipant?.identity;

          if (
            myIdentity &&
            data.targetUsers?.includes(myIdentity) &&
            data.breakoutRoomId
          ) {
            toast.info(t("assigned_by_host"));
            handleSwitchToBreakout(data.breakoutRoomId);
          }
        }
      } catch (error) {}
    };

    handleMetadataChanged(room.metadata);

    room.on(RoomEvent.RoomMetadataChanged, handleMetadataChanged);
    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.RoomMetadataChanged, handleMetadataChanged);
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, handleReturnToMain, handleSwitchToBreakout, t]);
}
