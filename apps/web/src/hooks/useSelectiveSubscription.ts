// hooks/useSelectiveSubscription.ts

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  TrackReferenceOrPlaceholder,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import {
  Participant,
  RemoteTrackPublication,
  RoomEvent,
  Track,
} from "livekit-client";

function makeKey(identity: string, source: Track.Source) {
  return `${identity}|${source}`;
}

function isWaiting(participant: Participant): boolean {
  try {
    if (participant.metadata) {
      const meta = JSON.parse(participant.metadata);
      return meta.status === "waiting";
    }
  } catch (e) {}
  return false;
}

export function useSelectiveSubscription() {
  const room = useRoomContext();

  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [metaTick, setMetaTick] = useState(0);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  // Selective Subscription Refs
  const lastDesiredRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile/Desktop
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Metadata change (duyệt vào phòng)
  useEffect(() => {
    const handleMetadataChanged = () => {
      setMetaTick((t) => t + 1);
      ensureAudioSubscribed();
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  }, [room]);

  // Lọc người đang chờ
  const validTracks = useMemo(() => {
    return allTracks.filter((t) => !isWaiting(t.participant));
  }, [allTracks, metaTick]);

  // Nếu người bị pin rời phòng / mất track → tự clear pin
  useEffect(() => {
    if (!pinnedKey) return;
    const stillExists = validTracks.some(
      (t) => makeKey(t.participant.identity, t.source) === pinnedKey,
    );
    if (!stillExists) {
      setPinnedKey(null);
    }
  }, [validTracks, pinnedKey]);

  const pageSize = isMobile ? 4 : 16;

  // Tính pages (có hỗ trợ pinned)
  const pages = useMemo(() => {
    const screenTracks = validTracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    let cameraTracks = validTracks.filter(
      (t) => t.source !== Track.Source.ScreenShare,
    );

    // Ghim local lên đầu + sort ổn định
    cameraTracks.sort((a, b) => {
      if (a.participant.isLocal && !b.participant.isLocal) return -1;
      if (!a.participant.isLocal && b.participant.isLocal) return 1;
      return a.participant.identity.localeCompare(b.participant.identity);
    });

    // Tìm track đang được pin (chỉ pin camera, không pin screenshare)
    const pinnedTrack = pinnedKey
      ? cameraTracks.find(
          (t) => makeKey(t.participant.identity, t.source) === pinnedKey,
        )
      : undefined;

    // Lọc người đã pin khỏi camera pages để tránh trùng
    if (pinnedTrack) {
      cameraTracks = cameraTracks.filter(
        (t) => makeKey(t.participant.identity, t.source) !== pinnedKey,
      );
    }

    const newPages: {
      type: "screenshare" | "pinned" | "camera";
      tracks: TrackReferenceOrPlaceholder[];
    }[] = [];

    // 1. Screen share luôn ưu tiên cao nhất
    if (screenTracks.length > 0) {
      newPages.push({ type: "screenshare", tracks: screenTracks });
    }

    // 2. Trang pinned (nếu có)
    if (pinnedTrack) {
      newPages.push({ type: "pinned", tracks: [pinnedTrack] });
    }

    // 3. Các trang camera
    for (let i = 0; i < cameraTracks.length; i += pageSize) {
      newPages.push({
        type: "camera",
        tracks: cameraTracks.slice(i, i + pageSize),
      });
    }

    return newPages;
  }, [validTracks, pageSize, pinnedKey]);

  const pinTrack = useCallback((trackRef: TrackReferenceOrPlaceholder) => {
    // Chỉ cho phép pin camera
    if (trackRef.source !== Track.Source.Camera) return;

    const key = makeKey(trackRef.participant.identity, trackRef.source);
    setPinnedKey((prev) => {
      // Toggle: nếu đang pin đúng người này → bỏ pin
      if (prev === key) return null;
      return key;
    });
  }, []);

  const unpin = useCallback(() => {
    setPinnedKey(null);
  }, []);

  const isPinned = useCallback(
    (trackRef: TrackReferenceOrPlaceholder) => {
      if (!pinnedKey) return false;
      return (
        makeKey(trackRef.participant.identity, trackRef.source) === pinnedKey
      );
    },
    [pinnedKey],
  );

  // Audio luôn subscribe (trừ người chờ)
  const ensureAudioSubscribed = useCallback(() => {
    room.remoteParticipants.forEach((participant) => {
      const micPub = participant.getTrackPublication(
        Track.Source.Microphone,
      ) as RemoteTrackPublication | undefined;

      if (micPub && typeof micPub.setSubscribed === "function") {
        const shouldSubscribe = !isWaiting(participant);
        if (micPub.isDesired !== shouldSubscribe) {
          micPub.setSubscribed(shouldSubscribe);
        }
      }
    });
  }, [room]);

  // Áp dụng subscribe video
  const applySubscriptions = useCallback(
    (desiredKeys: Set<string>) => {
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

        // Audio
        const micPub = participant.getTrackPublication(
          Track.Source.Microphone,
        ) as RemoteTrackPublication | undefined;

        if (micPub && typeof micPub.setSubscribed === "function") {
          const shouldSubscribeMic = !isWaiting(participant);
          if (micPub.isDesired !== shouldSubscribeMic) {
            micPub.setSubscribed(shouldSubscribeMic);
          }
        }
      });
    },
    [room, ensureAudioSubscribed],
  );

  const scheduleApply = useCallback(
    (desiredKeys: Set<string>) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        applySubscriptions(desiredKeys);
      }, 180);
    },
    [applySubscriptions],
  );

  // Effect chính: subscribe theo trang hiện tại + luôn giữ pinned
  useEffect(() => {
    if (!pages.length) {
      scheduleApply(new Set());
      return;
    }

    const activeItems = pages[currentPage]?.tracks ?? [];
    const desired = new Set<string>(
      activeItems.map((t) => makeKey(t.participant.identity, t.source)),
    );

    // Luôn giữ track đang pin trong desired (phòng trường hợp logic trang lỗi)
    if (pinnedKey) {
      desired.add(pinnedKey);
    }

    // Screen share cũng nên luôn được giữ nếu có (tùy chọn, hiện đã nằm trong pages)
    scheduleApply(desired);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [currentPage, pages, pinnedKey, scheduleApply]);

  // Track mới publish
  useEffect(() => {
    const onTrackPublished = (
      publication: RemoteTrackPublication,
      participant: any,
    ) => {
      if (isWaiting(participant)) return;

      if (publication.source === Track.Source.Microphone) {
        if (!publication.isDesired) {
          publication.setSubscribed(true);
        }
        return;
      }

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

  const hasScreenShare = validTracks.some(
    (t) => t.source === Track.Source.ScreenShare,
  );

  // Participant join → audio
  useEffect(() => {
    const onParticipantConnected = () => {
      ensureAudioSubscribed();
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    };
  }, [room, ensureAudioSubscribed]);

  useEffect(() => {
    ensureAudioSubscribed();
  }, [ensureAudioSubscribed]);

  // Có screen share → nhảy về trang 0
  useEffect(() => {
    if (hasScreenShare) setCurrentPage(0);
  }, [hasScreenShare]);

  // Có pin mới → nhảy về trang pinned (thường là sau screenshare)
  useEffect(() => {
    if (!pinnedKey) return;
    const pinnedPageIndex = pages.findIndex((p) => p.type === "pinned");
    if (pinnedPageIndex >= 0) {
      setCurrentPage(pinnedPageIndex);
    }
  }, [pinnedKey]); // chỉ khi pin thay đổi

  // Không bị lố trang
  useEffect(() => {
    if (pages.length > 0 && currentPage >= pages.length) {
      setCurrentPage(pages.length - 1);
    }
  }, [pages.length, currentPage]);

  return {
    tracks: validTracks,
    pages,
    currentPage,
    setCurrentPage,
    isMobile,
    // Pin API
    pinnedKey,
    pinTrack,
    unpin,
    isPinned,
  };
}
