import { useEffect, useState, useCallback } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/react-native";
import { RoomEvent, Participant } from "livekit-client";

export function useHandRaise() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [instantHands, setInstantHands] = useState<
    Record<string, { isRaised: boolean; raisedAt: string }>
  >({});

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
      } catch (error) {
        console.error(error);
      }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

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

      const payload = JSON.stringify({
        type: "HAND_TOGGLE",
        identity: localParticipant.identity,
        isRaised: newRaisedState,
        raisedAt: raisedAt,
      });
      await localParticipant.publishData(new TextEncoder().encode(payload), {
        reliable: true,
      });

      if (newRaisedState) {
        await localParticipant.setAttributes({ handRaised: "true", raisedAt });
      } else {
        await localParticipant.setAttributes({ handRaised: "", raisedAt: "" });
      }
    } catch (error) {
      console.error(error);
      setInstantHands((prev) => ({
        ...prev,
        [localParticipant.identity]: { isRaised: currentState, raisedAt: "0" },
      }));
    }
  };

  return {
    isLocalHandRaised: localParticipant
      ? getHandState(localParticipant).isRaised
      : false,
    toggleHandRaise,
    getHandState,
  };
}
