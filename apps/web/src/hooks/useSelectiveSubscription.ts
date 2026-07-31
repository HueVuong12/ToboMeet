// hooks/useSelectiveSubscription.ts

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  TrackReferenceOrPlaceholder,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import { RemoteTrackPublication, RoomEvent, Track } from "livekit-client";

function makeKey(identity: string, source: Track.Source) {
  return `${identity}|${source}`;
}

export function useSelectiveSubscription() {
  const room = useRoomContext();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Selective Subscription Refs
  const lastDesiredRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cập nhật trạng thái Mobile/Desktop
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const pageSize = isMobile ? 4 : 16;

  // Tính toán phân trang và sắp xếp
  const pages = useMemo(() => {
    const screenTracks = tracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    const cameraTracks = tracks.filter(
      (t) => t.source !== Track.Source.ScreenShare,
    );

    // Ghim local lên đầu + sort ổn định
    cameraTracks.sort((a, b) => {
      if (a.participant.isLocal && !b.participant.isLocal) return -1;
      if (!a.participant.isLocal && b.participant.isLocal) return 1;
      return a.participant.identity.localeCompare(b.participant.identity);
    });

    const newPages: {
      type: "screenshare" | "camera";
      tracks: TrackReferenceOrPlaceholder[];
    }[] = [];

    if (screenTracks.length > 0) {
      newPages.push({ type: "screenshare", tracks: screenTracks });
    }

    for (let i = 0; i < cameraTracks.length; i += pageSize) {
      newPages.push({
        type: "camera",
        tracks: cameraTracks.slice(i, i + pageSize),
      });
    }

    return newPages;
  }, [tracks, pageSize]);

  // Luôn subscribe toàn bộ audio
  const ensureAudioSubscribed = useCallback(() => {
    room.remoteParticipants.forEach((participant) => {
      const micPub = participant.getTrackPublication(
        Track.Source.Microphone,
      ) as RemoteTrackPublication | undefined;

      if (micPub && typeof micPub.setSubscribed === "function") {
        if (!micPub.isDesired) {
          micPub.setSubscribed(true);
        }
      }
    });
  }, [room]);

  // Hàm áp dụng Subscribe WebRTC
  const applySubscriptions = useCallback(
    (desiredKeys: Set<string>) => {
      // Return sớm nếu không có gì thay đổi
      if (
        desiredKeys.size === lastDesiredRef.current.size &&
        [...desiredKeys].every((k) => lastDesiredRef.current.has(k))
      ) {
        ensureAudioSubscribed();
        return;
      }

      lastDesiredRef.current = desiredKeys;

      room.remoteParticipants.forEach((participant) => {
        [Track.Source.Camera, Track.Source.ScreenShare].forEach((source) => {
          const pub = participant.getTrackPublication(source) as
            | RemoteTrackPublication
            | undefined;
          if (!pub || typeof pub.setSubscribed !== "function") return;

          const key = makeKey(participant.identity, source);
          const shouldSubscribe = desiredKeys.has(key);

          if (pub.isDesired !== shouldSubscribe) {
            pub.setSubscribed(shouldSubscribe);
            console.log(
              `[Web Reconciliation] ${shouldSubscribe ? "🟢 SUB" : "🔴 UNSUB"} → ${key}`,
            );
          }
        });

        const micPub = participant.getTrackPublication(
          Track.Source.Microphone,
        ) as RemoteTrackPublication | undefined;

        if (micPub && typeof micPub.setSubscribed === "function") {
          if (!micPub.isDesired) {
            micPub.setSubscribed(true);
          }
        }
      });
    },
    [room, ensureAudioSubscribed],
  );

  // Debounce nhẹ (tránh spam khi bấm chuyển trang liên tục)
  const scheduleApply = useCallback(
    (desiredKeys: Set<string>) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        applySubscriptions(desiredKeys);
      }, 180);
    },
    [applySubscriptions],
  );

  // Theo dõi sự thay đổi trang để kích hoạt (effect chính)
  useEffect(() => {
    if (!pages.length) return;
    const activeItems = pages[currentPage]?.tracks ?? [];
    const desired = new Set<string>(
      activeItems.map((t) => makeKey(t.participant.identity, t.source)),
    );
    scheduleApply(desired);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [currentPage, pages, scheduleApply]);

  // Lắng nghe track mới (Ví dụ người khác vừa bật cam)
  useEffect(() => {
    const onTrackPublished = (
      publication: RemoteTrackPublication,
      participant: any,
    ) => {
      // Audio luôn subscribe ngay
      if (publication.source === Track.Source.Microphone) {
        if (!publication.isDesired) {
          publication.setSubscribed(true);
        }
        return;
      }

      // Video chỉ sub nếu đang nằm ở trang hiện tại
      if (
        publication.source !== Track.Source.Camera &&
        publication.source !== Track.Source.ScreenShare
      )
        return;

      const key = makeKey(participant.identity, publication.source);
      if (lastDesiredRef.current.has(key) && !publication.isDesired) {
        publication.setSubscribed(true);
        console.log(`[Web TrackPublished] 🟢 SUB immediate → ${key}`);
      }
    };

    room.on(RoomEvent.TrackPublished, onTrackPublished);
    return () => {
      room.off(RoomEvent.TrackPublished, onTrackPublished);
    };
  }, [room]);

  const hasScreenShare = tracks.some(
    (t) => t.source === Track.Source.ScreenShare,
  );

  // Khi có người mới join → đảm bảo audio của họ được sub
  useEffect(() => {
    const onParticipantConnected = () => {
      ensureAudioSubscribed();
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    };
  }, [room, ensureAudioSubscribed]);

  // Lần đầu mount cũng đảm bảo audio
  useEffect(() => {
    ensureAudioSubscribed();
  }, [ensureAudioSubscribed]);

  // Tự động nhảy về trang đầu khi có Screen Share
  useEffect(() => {
    if (hasScreenShare) setCurrentPage(0);
  }, [hasScreenShare]);

  // Đảm bảo không bị lố trang
  useEffect(() => {
    if (pages.length > 0 && currentPage >= pages.length) {
      setCurrentPage(pages.length - 1);
    }
  }, [pages.length, currentPage]);

  return {
    tracks,
    pages,
    currentPage,
    setCurrentPage,
    isMobile,
  };
}
