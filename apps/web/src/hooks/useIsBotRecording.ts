import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent, Participant } from "livekit-client";

export interface BotRecordingState {
  isRecording: boolean;
  recordingId: string | null;
  sessionId: string | null;
  roomName: string | null;
}

/**
 * Hook lắng nghe Data Channel phát ra từ Recorder Bot (topic: "RECORDING_STATUS" hoặc type: "RECORDING_STATUS")
 * Trả về chi tiết trạng thái ghi hình và lưu vào React state.
 */
export function useBotRecording(): BotRecordingState {
  const room = useRoomContext();
  const [recordingState, setRecordingState] = useState<BotRecordingState>(() => {
    let initialIsRecording = false;
    if (room) {
      for (const p of room.remoteParticipants.values()) {
        if (p.identity.startsWith("recorder-bot-")) {
          initialIsRecording = true;
          break;
        }
      }
    }
    return {
      isRecording: initialIsRecording,
      recordingId: null,
      sessionId: null,
      roomName: room?.name || null,
    };
  });

  useEffect(() => {
    if (!room) return;

    // Kiểm tra ban đầu khi mount: nếu trong phòng đã có participant bot
    for (const p of room.remoteParticipants.values()) {
      if (p.identity.startsWith("recorder-bot-")) {
        setRecordingState((prev) => ({
          ...prev,
          isRecording: true,
        }));
        break;
      }
    }

    // Lắng nghe gói tin Data Channel phát từ Recorder Bot
    const handleDataReceived = (
      payload: Uint8Array,
      participant?: Participant,
      kind?: any,
      topic?: string
    ) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (topic === "RECORDING_STATUS" || data.type === "RECORDING_STATUS") {
          const isRec = Boolean(data.is_recording);
          setRecordingState({
            isRecording: isRec,
            recordingId: data.recording_id || null,
            sessionId: data.session_id || null,
            roomName: data.room_name || room.name,
          });
        }
      } catch {
        // Bỏ qua payload không phải JSON
      }
    };

    // Khi bot ngắt kết nối khỏi phòng (khi dừng ghi)
    const handleParticipantDisconnected = (participant: Participant) => {
      if (participant.identity.startsWith("recorder-bot-")) {
        let hasOtherBot = false;
        for (const p of room.remoteParticipants.values()) {
          if (p.identity !== participant.identity && p.identity.startsWith("recorder-bot-")) {
            hasOtherBot = true;
            break;
          }
        }
        if (!hasOtherBot) {
          setRecordingState((prev) => ({
            ...prev,
            isRecording: false,
          }));
        }
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  return recordingState;
}

/**
 * Hook tương tự useIsRecording của LiveKit nhưng hoạt động với Recorder Bot qua Data Channel.
 * Trả về boolean: true nếu bot đang ghi hình, false nếu đã dừng.
 */
export function useIsBotRecording(): boolean {
  const { isRecording } = useBotRecording();
  return isRecording;
}

export default useIsBotRecording;
