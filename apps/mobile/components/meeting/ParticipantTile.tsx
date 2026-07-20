import React from "react";
import { View, Text, Image } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

import { TrackReference, VideoView } from "@livekit/react-native";
import { Track, VideoTrack } from "livekit-client";
import { useHandRaise } from "../../hooks/useHandRaise";

// COMPONENT: Ô VIDEO TÁI SỬ DỤNG (TILE)
export default function ParticipantTile({
  trackRef,
}: {
  trackRef: TrackReference;
}) {
  const publication = trackRef.publication;
  const videoTrack = publication?.track as VideoTrack;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  const isMuted = publication?.isMuted ?? false;
  const showVideo = !!videoTrack && !isMuted;
  const { getHandState } = useHandRaise();
  const handState = getHandState(trackRef.participant);

  // Xử lý Metadata để lấy Avatar
  let avatarUrl = null;
  try {
    if (trackRef.participant.metadata) {
      const meta = JSON.parse(trackRef.participant.metadata);
      avatarUrl = meta.avatarUrl;
    }
  } catch (error) {
    // Bỏ qua nếu metadata không hợp lệ
    console.error(error);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#1e293b",
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: isScreenShare ? 2 : 1,
        borderColor: isScreenShare ? "#3b82f6" : "#334155",
      }}
    >
      {/* VIDEO HOẶC AVATAR */}
      {showVideo ? (
        <VideoView
          style={{ flex: 1 }}
          videoTrack={videoTrack}
          objectFit={isScreenShare ? "contain" : "cover"}
        />
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#1e293b",
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 64, height: 64, borderRadius: 32 }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#3b82f6",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "white", fontSize: 28, fontWeight: "bold" }}
              >
                {trackRef.participant.name?.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* BADGE GIƠ TAY NỔI TRÊN GÓC PHẢI */}
      {handState.isRaised && (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: "rgba(245, 158, 11, 0.9)", // Màu amber-500
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#fbbf24",
            zIndex: 10,
          }}
        >
          <Ionicons
            name="hand-left"
            size={12}
            color="white"
            style={{ marginRight: 4 }}
          />
          <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
            Giơ tay
          </Text>
        </View>
      )}

      {/* BADGE TÊN & TRẠNG THÁI */}
      <View
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          backgroundColor: "rgba(0,0,0,0.6)",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          flexDirection: "row",
          alignItems: "center",
          maxWidth: "90%",
        }}
      >
        {isScreenShare && (
          <Feather
            name="monitor"
            size={12}
            color="#60a5fa"
            style={{ marginRight: 4 }}
          />
        )}
        {!showVideo && !isScreenShare && (
          <Feather
            name="video-off"
            size={12}
            color="#f87171"
            style={{ marginRight: 4 }}
          />
        )}
        <Text
          style={{ color: "white", fontSize: 12, fontWeight: "bold" }}
          numberOfLines={1}
        >
          {trackRef.participant.name || "Khách"}{" "}
          {isScreenShare && "đang chia sẻ"}
        </Text>
      </View>
    </View>
  );
}
