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
  VideoQuality,
} from "livekit-client";
import { isAgentParticipant } from "../utils/participant";

function makeKey(identity: string, source: Track.Source) {
  return `${identity}|${source}`;
}

// Hàm Helper: Kiểm tra xem người dùng có đang ở phòng chờ không
function isWaiting(participant: Participant): boolean {
  try {
    if (participant.metadata) {
      const meta = JSON.parse(participant.metadata);
      return meta.status === "waiting";
    }
  } catch (e) {
    console.error("Lỗi phân tích metadata của người tham gia:", e);
  }
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

  const [currentPage, setCurrentPage] = useState(0);
  const [metaTick, setMetaTick] = useState(0); // State để force update khi có người được duyệt

  // Selective Subscription Refs
  const lastDesiredRef = useRef<Set<string>>(new Set());
  const activeCameraCountRef = useRef<number>(1);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getDesiredCameraQuality = useCallback(() => {
    const count = activeCameraCountRef.current;
    if (count <= 1) return VideoQuality.HIGH;
    if (count === 2) return VideoQuality.MEDIUM;
    return VideoQuality.LOW;
  }, []);

  // Bắt sự kiện có người thay đổi Metadata (vd: được duyệt vào phòng) để tính toán lại layout
  useEffect(() => {
    const handleMetadataChanged = () => {
      setMetaTick((t) => t + 1);
      ensureAudioSubscribed(); // Ép check lại Audio ngay lập tức
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  }, [room]);

  // LỌC BỎ CÁC TRACK CỦA NHỮNG NGƯỜI ĐANG Ở PHÒNG CHỜ VÀ AGENT/BOT
  const validTracks = useMemo(() => {
    return allTracks.filter(
      (t) => !isWaiting(t.participant) && !isAgentParticipant(t.participant),
    );
  }, [allTracks, metaTick]);

  const pageSize = 4; // Trên Mobile chỉ hiện tối đa 4 camera mỗi trang

  // Tính toán phân trang và sắp xếp (Sử dụng validTracks thay vì allTracks)
  const pages = useMemo(() => {
    const screenTracks = validTracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    const cameraTracks = validTracks.filter(
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
      items: TrackReferenceOrPlaceholder[];
    }[] = [];

    if (screenTracks.length > 0) {
      newPages.push({ type: "screenshare", items: screenTracks });
    }

    for (let i = 0; i < cameraTracks.length; i += pageSize) {
      newPages.push({
        type: "camera",
        items: cameraTracks.slice(i, i + pageSize),
      });
    }

    return newPages;
  }, [validTracks, pageSize]);

  // Luôn subscribe toàn bộ audio (Microphone + ScreenShareAudio) NGOẠI TRỪ NGƯỜI ĐANG CHỜ VÀ AGENT
  const ensureAudioSubscribed = useCallback(() => {
    room.remoteParticipants.forEach((participant) => {
      if (isAgentParticipant(participant)) return;

      const shouldSubscribe = !isWaiting(participant);
      [Track.Source.Microphone, Track.Source.ScreenShareAudio].forEach(
        (audioSource) => {
          const audioPub = participant.getTrackPublication(audioSource) as
            | RemoteTrackPublication
            | undefined;

          if (audioPub && typeof audioPub.setSubscribed === "function") {
            if (audioPub.isDesired !== shouldSubscribe) {
              audioPub.setSubscribed(shouldSubscribe);
            }
          }
        },
      );
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
        // 1. Quản lý Video & ScreenShare (Dựa vào phân trang)
        [Track.Source.Camera, Track.Source.ScreenShare].forEach((source) => {
          const pub = participant.getTrackPublication(source) as
            | RemoteTrackPublication
            | undefined;
          if (!pub || typeof pub.setSubscribed !== "function") return;

          const key = makeKey(participant.identity, source);
          // desiredKeys chỉ chứa những người hợp lệ trên page hiện tại
          const shouldSubscribe = desiredKeys.has(key);

          if (pub.isDesired !== shouldSubscribe) {
            pub.setSubscribed(shouldSubscribe);
            console.log(
              `[Reconciliation] ${shouldSubscribe ? "🟢 SUB" : "🔴 UNSUB"} → ${key}`,
            );
          }

          // Phân tầng chất lượng: ScreenShare luôn ưu tiên HIGH (SFU tự hạ xuống 720p/540p nếu mạng yếu),
          // còn Camera tự giới hạn theo số ô trên trang để nhường băng thông.
          if (shouldSubscribe && typeof pub.setVideoQuality === "function") {
            const targetQuality =
              source === Track.Source.ScreenShare
                ? VideoQuality.HIGH
                : getDesiredCameraQuality();
            try {
              pub.setVideoQuality(targetQuality);
            } catch {
              // Bỏ qua nếu track chưa sẵn sàng cập nhật quality
            }
          }
        });

        // 2. Quản lý Audio (Microphone + ScreenShareAudio): Tắt tiếng của những người đang chờ
        if (!isAgentParticipant(participant)) {
          const shouldSubscribeAudio = !isWaiting(participant);
          [Track.Source.Microphone, Track.Source.ScreenShareAudio].forEach(
            (audioSource) => {
              const audioPub = participant.getTrackPublication(audioSource) as
                | RemoteTrackPublication
                | undefined;

              if (audioPub && typeof audioPub.setSubscribed === "function") {
                if (audioPub.isDesired !== shouldSubscribeAudio) {
                  audioPub.setSubscribed(shouldSubscribeAudio);
                }
              }
            },
          );
        }
      });
    },
    [room, ensureAudioSubscribed, getDesiredCameraQuality],
  );

  // Debounce nhẹ (tránh spam khi bấm chuyển trang liên tục)
  const scheduleApply = useCallback(
    (desiredKeys: Set<string>) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(() => {
        applySubscriptions(desiredKeys);
      }, 220); // Mobile debounce có thể để cao hơn Web một chút cho mượt
    },
    [applySubscriptions],
  );

  // Theo dõi sự thay đổi trang để kích hoạt (effect chính)
  useEffect(() => {
    if (!pages.length) {
      scheduleApply(new Set()); // Nếu không có ai hợp lệ, clear toàn bộ sub video
      return;
    }
    const activePage = pages[currentPage];
    const activeItems = activePage?.items ?? [];
    activeCameraCountRef.current =
      activePage?.type === "camera" ? activeItems.length : 1;
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
      participant: Participant,
    ) => {
      // Chặn ngay lập tức không subscribe bất kì thứ gì nếu đang ở phòng chờ hoặc là agent
      if (isWaiting(participant) || isAgentParticipant(participant)) return;

      // Audio (Microphone + ScreenShareAudio) luôn subscribe ngay
      if (
        publication.source === Track.Source.Microphone ||
        publication.source === Track.Source.ScreenShareAudio
      ) {
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
        if (typeof publication.setVideoQuality === "function") {
          const targetQuality =
            publication.source === Track.Source.ScreenShare
              ? VideoQuality.HIGH
              : getDesiredCameraQuality();
          try {
            publication.setVideoQuality(targetQuality);
          } catch {}
        }
        console.log(`[TrackPublished] 🟢 SUB immediate → ${key}`);
      }
    };

    const onTrackSubscribed = (
      _track: any,
      publication: RemoteTrackPublication,
    ) => {
      if (
        (publication.source === Track.Source.ScreenShare ||
          publication.source === Track.Source.Camera) &&
        typeof publication.setVideoQuality === "function"
      ) {
        const targetQuality =
          publication.source === Track.Source.ScreenShare
            ? VideoQuality.HIGH
            : getDesiredCameraQuality();
        try {
          publication.setVideoQuality(targetQuality);
        } catch {}
      }
    };

    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    };
  }, [room, getDesiredCameraQuality]);

  const hasScreenShare = validTracks.some(
    (t) => t.source === Track.Source.ScreenShare,
  );

  const isSomeoneElseSharing = validTracks.some(
    (t) => t.source === Track.Source.ScreenShare && !t.participant.isLocal,
  );

  // Khi có người mới join → đảm bảo audio của họ được xử lý
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
    tracks: validTracks,
    pages,
    currentPage,
    setCurrentPage,
    isSomeoneElseSharing,
  };
}
