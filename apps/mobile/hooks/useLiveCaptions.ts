import { useEffect, useState, useCallback, useRef } from "react";
import { Room } from "livekit-client";

export interface LiveCaptionItem {
  id: string;
  text: string;
  speakerId?: string;
  speakerName?: string;
  isFinal: boolean;
  timestamp: number;
}

export function useLiveCaptions(room: Room | undefined, enabled: boolean) {
  const [captions, setCaptions] = useState<LiveCaptionItem[]>([]);
  const roomRef = useRef<Room | undefined>(room);
  roomRef.current = room;

  const resolveSpeakerName = useCallback(
    (speakerId?: string, fallbackName?: string) => {
      if (fallbackName && fallbackName.trim()) {
        return fallbackName;
      }
      const currentRoom = roomRef.current;
      if (!currentRoom || !speakerId) {
        return "Người tham gia";
      }

      if (currentRoom.localParticipant?.identity === speakerId) {
        return currentRoom.localParticipant.name || "Bạn";
      }

      const remote = currentRoom.getParticipantByIdentity(speakerId);
      return remote?.name || speakerId;
    },
    [],
  );

  const upsertCaption = useCallback(
    (
      id: string,
      text: string,
      isFinal: boolean,
      speakerId?: string,
      rawSpeakerName?: string,
      timestamp?: number,
    ) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      const speakerName = resolveSpeakerName(speakerId, rawSpeakerName);

      setCaptions((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === id);
        const item: LiveCaptionItem = {
          id,
          text: cleanText,
          speakerId,
          speakerName,
          isFinal,
          timestamp: timestamp || Date.now(),
        };

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = item;
          return next;
        }

        // Giữ tối đa 50 câu gần nhất theo yêu cầu
        return [...prev.slice(-49), item];
      });
    },
    [resolveSpeakerName],
  );

  useEffect(() => {
    if (!room || !enabled) return;

    const streamHandler = async (
      reader: any,
      participantInfo: { identity?: string },
    ) => {
      try {
        const text = await reader.readAll();
        if (!text?.trim()) return;

        const info = reader.info;
        const attributes = info?.attributes || {};
        const segmentId =
          attributes["lk.transcription_segment_id"] ||
          info?.id ||
          `seg_${Date.now()}`;
        const isFinal = attributes["lk.transcription_final"] === "true";
        const speakerId = attributes["speaker_id"] || participantInfo?.identity;
        const speakerName = attributes["speaker_name"];

        upsertCaption(segmentId, text, isFinal, speakerId, speakerName);
      } catch (err) {
        console.error("[useLiveCaptions] Error reading text stream:", err);
      }
    };

    try {
      room.registerTextStreamHandler?.("lk.transcription", streamHandler);
    } catch (e) {
      console.warn("[useLiveCaptions] Could not register text stream handler:", e);
    }

    return () => {
      try {
        room.unregisterTextStreamHandler?.("lk.transcription");
      } catch { }
    };
  }, [room, upsertCaption]);

  // Chỉ reset phụ đề khi rời phòng (ngắt kết nối room)
  useEffect(() => {
    if (!room) {
      setCaptions([]);
    }
  }, [room]);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
  }, []);

  return {
    captions,
    clearCaptions,
  };
}
