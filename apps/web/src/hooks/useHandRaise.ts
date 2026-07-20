import { useEffect, useState, useCallback } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent, Participant } from "livekit-client";

export function useHandRaise() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  // Lưu trữ trạng thái nhận được tức thì qua Data Channel
  const [instantHands, setInstantHands] = useState<
    Record<string, { isRaised: boolean; raisedAt: string }>
  >({});

  // Lắng nghe data channel
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "HAND_TOGGLE") {
          setInstantHands((prev) => ({
            ...prev,
            [data.identity]: {
              isRaised: data.isRaised,
              raisedAt: data.raisedAt,
            },
          }));
        }
      } catch (error) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Hợp nhất trạng thái (Lấy UDP trước, nếu không có thì lấy Attributes)
  const getHandState = useCallback(
    (p: Participant) => {
      const instant = instantHands[p.identity];
      if (instant !== undefined) return instant;
      return {
        isRaised: p.attributes?.handRaised === "true",
        raisedAt: p.attributes?.raisedAt || "0",
      };
    },
    [instantHands],
  );

  const toggleHandRaise = async () => {
    if (!localParticipant) return;

    const currentState = getHandState(localParticipant).isRaised;
    const newRaisedState = !currentState;
    const raisedAt = Date.now().toString();

    try {
      setInstantHands((prev) => ({
        ...prev,
        [localParticipant.identity]: { isRaised: newRaisedState, raisedAt },
      }));

      // Phát tín hiệu tức thời cho người khác
      const payload = JSON.stringify({
        type: "HAND_TOGGLE",
        identity: localParticipant.identity,
        isRaised: newRaisedState,
        raisedAt: raisedAt,
      });
      await localParticipant.publishData(new TextEncoder().encode(payload), {
        reliable: true,
      });

      // Cập nhật attribute để đảm bảo nhất quán dữ liệu
      if (newRaisedState) {
        await localParticipant.setAttributes({ handRaised: "true", raisedAt });
      } else {
        await localParticipant.setAttributes({ handRaised: "", raisedAt: "" });
      }
    } catch (error) {
      console.error("Lỗi khi giơ tay:", error);
      // Rollback UI nếu bị lỗi (rớt mạng...)
      setInstantHands((prev) => ({
        ...prev,
        [localParticipant.identity]: { isRaised: currentState, raisedAt: "0" },
      }));
    }
  };

  // Trả về các công cụ cần thiết cho Component sử dụng
  return {
    isLocalHandRaised: localParticipant
      ? getHandState(localParticipant).isRaised
      : false,
    toggleHandRaise,
    getHandState,
  };
}
