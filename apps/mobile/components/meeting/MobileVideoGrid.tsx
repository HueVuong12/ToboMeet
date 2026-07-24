import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";

import { useTracks, useLocalParticipant, TrackReference } from "@livekit/components-react";
import { RemoteTrackPublication, Track } from "livekit-client";
import ParticipantTile from "./ParticipantTile";

const { width: windowWidth } = Dimensions.get("window");

function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export default function MobileVideoGrid() {
  const [currentPage, setCurrentPage] = useState(0);
  const { localParticipant } = useLocalParticipant();

  // Lấy toàn bộ track từ những người trong phòng (dù chưa được subscribe)
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Chia mảng thành các trang 4 người
  const pages = useMemo(() => {
    const screenShareTracks = tracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);
    const cameraPages = chunkArray(cameraTracks, 4);

    const newPages: any[] = [];
    screenShareTracks.forEach((trackRef) =>
      newPages.push({ type: "screenshare", items: [trackRef] }),
    );
    cameraPages.forEach((chunk) =>
      newPages.push({ type: "camera", items: chunk }),
    );

    return newPages;
  }, [tracks]);

  // Đăng ký có chọn lọc track (selective subscribtion)
  useEffect(() => {
    // Nếu chưa có trang nào thì bỏ qua
    if (!pages || pages.length === 0) return;

    // Lấy danh sách track của NHỮNG NGƯỜI ĐANG Ở TRANG HIỆN TẠI
    const activeItems = pages[currentPage]?.items || [];
    const activeKeys = new Set(
      activeItems.map((t: any) => `${t.participant.identity}_${t.source}`),
    );

    tracks.forEach(async (trackRef) => {
      // Bỏ qua bản thân (LocalParticipant luôn tự hiển thị media của mình)
      if (trackRef.participant.identity === localParticipant.identity) return;

      const key = `${trackRef.participant.identity}_${trackRef.source}`;
      const pub = trackRef.publication as RemoteTrackPublication;

      if (pub && typeof pub.setSubscribed === "function") {
        const isCurrentlySubscribed = pub.isSubscribed;

        // So sánh xem người này có nằm trong Set của trang hiện tại không
        const shouldBeSubscribed = activeKeys.has(key);

        if (shouldBeSubscribed && !isCurrentlySubscribed) {
          try {
            await pub.setSubscribed(true);
            console.log(`Đã Subscribe: ${pub.trackSid || key}`);
          } catch (error) {
            console.error("Lỗi Subscribe:", error);
          }
        } else if (!shouldBeSubscribed && isCurrentlySubscribed) {
          try {
            await pub.setSubscribed(false);
            console.log(`Đã Hủy Subscribe: ${pub.trackSid || key}`);
          } catch (error) {
            console.error("Lỗi Hủy Subscribe:", error);
          }
        }
      }
    });
  }, [currentPage, pages, tracks, localParticipant.identity]);

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
          // Tính toán trang hiện tại khi người dùng vuốt xong
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.x / windowWidth,
          );
          setCurrentPage(newIndex);
        }}
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={2}
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
