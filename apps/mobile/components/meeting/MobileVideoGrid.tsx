import React, { useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from "react-native";
import { TrackReference } from "@livekit/components-react";
import ParticipantTile from "./ParticipantTile";
import { useSelectiveSubscription } from "../../hooks/useSelectiveSubscription";

const { width: windowWidth } = Dimensions.get("window");

export default function MobileVideoGrid() {
  const { tracks, pages, currentPage, setCurrentPage } =
    useSelectiveSubscription();

  const renderPage = useCallback(({ item }: { item: any }) => {
    const isScreenShare = item.type === "screenshare";
    const tracksCount = item.items.length;

    return (
      <View
        style={{ width: windowWidth }} // Giữ lại inline style cho windowWidth để FlatList chia trang chính xác
        className="flex-1 flex-row flex-wrap content-center justify-center"
      >
        {item.items.map((trackRef: TrackReference) => {
          // Tính toán class NativeWind thay cho style object
          let itemClass = "border border-[#232328] bg-[#121215]";

          if (isScreenShare || tracksCount === 1) {
            itemClass = "w-full h-full border-0 bg-[#121215]";
          } else if (tracksCount === 2) {
            itemClass += " w-full h-1/2";
          } else {
            itemClass += " w-1/2 h-1/2";
          }

          return (
            <View
              key={`${trackRef.participant.identity}_${trackRef.source}`}
              className={itemClass}
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
      <View className="flex-1 justify-center items-center bg-[#0a0a0c]">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="text-slate-400 mt-3 text-xs">
          Đang đợi người khác tham gia...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#0a0a0c]">
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

      {/* Chấm tròn phân trang (Pagination Dots) */}
      {pages.length > 1 && (
        <View className="absolute bottom-5 flex-row justify-center items-center self-center bg-[#111113]/80 border border-[#232328] py-1.5 px-2.5 rounded-full">
          {pages.map((_, index) => (
            <View
              key={index}
              className={`h-1.5 rounded-full mx-1 ${
                currentPage === index ? "w-4 bg-blue-500" : "w-1.5 bg-[#4b4b58]"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
