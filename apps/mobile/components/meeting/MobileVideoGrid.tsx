// MobileVideoGrid.tsx
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";

import {
  useTracks,
  useRoomContext,
  TrackReference,
} from "@livekit/components-react";
import { RemoteTrackPublication, RoomEvent, Track } from "livekit-client";
import ParticipantTile from "./ParticipantTile";

const { width: windowWidth } = Dimensions.get("window");

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function makeKey(identity: string, source: Track.Source) {
  return `${identity}|${source}`;
}

export default function MobileVideoGrid() {
  const [currentPage, setCurrentPage] = useState(0);
  const room = useRoomContext();

  // Chỉ lưu desired keys hiện tại (dùng để so sánh nhanh)
  const lastDesiredRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Xây dựng pages
  const pages = useMemo(() => {
    const screenShareTracks = tracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);

    cameraTracks.sort((a, b) => {
      if (a.participant.isLocal && !b.participant.isLocal) return -1;
      if (!a.participant.isLocal && b.participant.isLocal) return 1;
      return a.participant.identity.localeCompare(b.participant.identity);
    });

    const cameraPages = chunkArray(cameraTracks, 4);
    const newPages: { type: "screenshare" | "camera"; items: any[] }[] = [];

    screenShareTracks.forEach((trackRef) =>
      newPages.push({ type: "screenshare", items: [trackRef] }),
    );
    cameraPages.forEach((chunk) =>
      newPages.push({ type: "camera", items: chunk }),
    );

    return newPages;
  }, [tracks]);

  // Áp dụng subscription – chỉ khi intent thực sự khác
  const applySubscriptions = useCallback(
    (desiredKeys: Set<string>) => {
      // So sánh Set nhanh: nếu giống hệt thì bỏ qua
      if (
        desiredKeys.size === lastDesiredRef.current.size &&
        [...desiredKeys].every((k) => lastDesiredRef.current.has(k))
      ) {
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

          // QUAN TRỌNG: dùng isDesired (intent), KHÔNG dùng isSubscribed
          if (pub.isDesired !== shouldSubscribe) {
            pub.setSubscribed(shouldSubscribe);
            console.log(
              `[Reconciliation] ${shouldSubscribe ? "🟢 SUB" : "🔴 UNSUB"} → ${key}`,
            );
          }
        });
      });
    },
    [room],
  );

  // Debounced apply
  const scheduleApply = useCallback(
    (desiredKeys: Set<string>) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Chỉ apply sau khi người dùng dừng vuốt 220ms
      debounceTimerRef.current = setTimeout(() => {
        applySubscriptions(desiredKeys);
      }, 220);
    },
    [applySubscriptions],
  );

  // Effect chính – chạy khi currentPage hoặc pages đổi
  useEffect(() => {
    if (!pages.length) return;

    const activeItems = pages[currentPage]?.items ?? [];
    const desired = new Set<string>(
      activeItems.map((t: any) => makeKey(t.participant.identity, t.source)),
    );

    scheduleApply(desired);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentPage, pages, scheduleApply]);

  // Listener nhẹ – chỉ bắt track mới thuộc trang đang xem
  useEffect(() => {
    const onTrackPublished = (
      publication: RemoteTrackPublication,
      participant: any,
    ) => {
      if (
        publication.source !== Track.Source.Camera &&
        publication.source !== Track.Source.ScreenShare
      ) {
        return;
      }

      const key = makeKey(participant.identity, publication.source);

      // Chỉ subscribe nếu track này thuộc desired hiện tại
      if (lastDesiredRef.current.has(key) && !publication.isDesired) {
        publication.setSubscribed(true);
        console.log(`[TrackPublished] 🟢 SUB immediate → ${key}`);
      }
    };

    room.on(RoomEvent.TrackPublished, onTrackPublished);

    return () => {
      room.off(RoomEvent.TrackPublished, onTrackPublished);
    };
  }, [room]);

  const renderPage = useCallback(({ item }: { item: any }) => {
    const isScreenShare = item.type === "screenshare";
    const tracksCount = item.items.length;

    return (
      <View
        style={{
          width: windowWidth,
          flex: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
        }}
      >
        {item.items.map((trackRef: TrackReference) => {
          let itemStyle: any = {
            borderWidth: 1,
            borderColor: "#000",
            backgroundColor: "#111",
          };

          if (isScreenShare || tracksCount === 1) {
            itemStyle = {
              ...itemStyle,
              width: "100%",
              height: "100%",
              borderWidth: 0,
            };
          } else if (tracksCount === 2) {
            itemStyle = { ...itemStyle, width: "100%", height: "50%" };
          } else {
            itemStyle = { ...itemStyle, width: "50%", height: "50%" };
          }

          return (
            <View
              key={`${trackRef.participant.identity}_${trackRef.source}`}
              style={itemStyle}
            >
              <ParticipantTile trackRef={trackRef} />
            </View>
          );
        })}
      </View>
    );
  }, []);

  if (tracks.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: "#9ca3af", marginTop: 12 }}>
          Đang đợi người khác tham gia...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderPage}
        keyExtractor={(_, index) => `page_${index}`}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.x / windowWidth,
          );
          setCurrentPage(newIndex);
        }}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        removeClippedSubviews={true}
      />

      {pages.length > 1 && (
        <View
          style={{
            position: "absolute",
            bottom: 20,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            alignSelf: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 16,
          }}
        >
          {pages.map((_, index) => (
            <View
              key={index}
              style={{
                width: currentPage === index ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: currentPage === index ? "#3b82f6" : "#666",
                marginHorizontal: 3,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
