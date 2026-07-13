import React, { useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";

import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import ParticipantTile from "./ParticipantTile";

const { width: windowWidth } = Dimensions.get("window");

// HÀM HỖ TRỢ: CHIA NHỎ MẢNG (CHUNK)
function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// COMPONENT: LƯỚI VIDEO
export default function MobileVideoGrid() {
  const [currentPage, setCurrentPage] = useState(0);

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  if (tracks.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: "#94a3b8", marginTop: 12 }}>
          Đang đợi người khác tham gia...
        </Text>
      </View>
    );
  }

  // Tách Share Screen và Camera
  const screenShareTracks = tracks.filter(
    (t) => t.source === Track.Source.ScreenShare,
  );
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);
  const cameraPages = chunkArray(cameraTracks, 6);

  const pages: any[] = [];
  // Đưa màn hình Share Screen lên trang đầu tiên
  screenShareTracks.forEach((trackRef) =>
    pages.push({ type: "screenshare", items: [trackRef] }),
  );
  cameraPages.forEach((chunk) => pages.push({ type: "camera", items: chunk }));

  const renderPage = ({ item }: { item: any }) => {
    const isScreenShare = item.type === "screenshare";
    const tracksCount = item.items.length;

    return (
      <View
        style={{
          width: windowWidth,
          flex: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          padding: 4,
          alignContent: "center",
          justifyContent: "center",
        }}
      >
        {item.items.map((trackRef: any) => {
          let itemStyle: any = { padding: 4 };
          if (isScreenShare || tracksCount === 1)
            itemStyle = { ...itemStyle, width: "100%", height: "100%" };
          else if (tracksCount === 2)
            itemStyle = { ...itemStyle, width: "100%", height: "50%" };
          else if (tracksCount === 3 || tracksCount === 4)
            itemStyle = { ...itemStyle, width: "50%", height: "50%" };
          else itemStyle = { ...itemStyle, width: "50%", height: "33.33%" };

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
  };

  return (
    <View style={{ flex: 1 }}>
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
      />
      {pages.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            paddingVertical: 12,
          }}
        >
          {pages.map((_, index) => (
            <View
              key={index}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: currentPage === index ? "#ffffff" : "#475569",
                marginHorizontal: 4,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
