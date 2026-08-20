// hooks/useBreakoutSync.ts
import { useEffect } from "react";
import { useRoomContext } from "@livekit/react-native";
import { RoomEvent } from "livekit-client";
import { LivekitRoomMetadata } from "@tobomeet/shared/types";
import { useMeetingSessionContext } from "../components/meeting/contexts/MeetingSessionContext";
import { toast } from "../lib/toast";
import { useTranslation } from "react-i18next";

export function useBreakoutSync() {
  const { t } = useTranslation();
  const room = useRoomContext();
  const { handleSwitchToBreakout, handleReturnToMain } =
    useMeetingSessionContext();

  // Lắng nghe TẤT CẢ sự kiện Breakout: Đóng phòng (Metadata) và Bị kéo vào phòng (DataChannel)
  useEffect(() => {
    if (!room) return;

    const handleMetadataChanged = (metadataStr: string | undefined) => {
      if (!metadataStr) return;
      try {
        const meta: LivekitRoomMetadata = JSON.parse(metadataStr);
        if (meta.roomType === "breakout" && meta.status === "closing") {
          toast.info(
            t("meeting.breakout_sync.session_ended", {
              defaultValue: "Phiên thảo luận đã kết thúc",
            }),
          );
          handleReturnToMain(room.name);
        }
      } catch (error) {
        console.error("Lỗi parse metadata breakout:", error);
      }
    };

    const handleDataReceived = (payload: Uint8Array) => {
      let jsonString = "";
      try {
        if (typeof TextDecoder !== "undefined") {
          jsonString = new TextDecoder().decode(payload);
        } else {
          const Buffer = require("buffer").Buffer;
          jsonString = Buffer.from(payload).toString("utf8");
        }
      } catch (e) {
        let result = "";
        for (let i = 0; i < payload.length; i++) {
          result += String.fromCharCode(payload[i]);
        }
        jsonString = decodeURIComponent(escape(result));
      }

      try {
        const data = JSON.parse(jsonString) as any;

        if (data.type === "SYSTEM" && data.command === "FORCE_JOIN_BREAKOUT") {
          const myIdentity = room.localParticipant?.identity;

          if (
            myIdentity &&
            data.targetUsers?.includes(myIdentity) &&
            data.breakoutRoomId
          ) {
            toast.info(
              t("meeting.breakout_sync.assigned_by_host", {
                defaultValue:
                  "Host đã chỉ định bạn vào phòng thảo luận. Đang chuyển hướng...",
              }),
            );
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
