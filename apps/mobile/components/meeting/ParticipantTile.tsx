import React, { useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Track, VideoTrack } from "livekit-client";
import { useHandRaise } from "../../hooks/useHandRaise";
import { VideoView } from "@livekit/react-native";

// COMPONENT: Ô VIDEO TÁI SỬ DỤNG (TILE)
export default function ParticipantTile({
  trackRef,
}: {
  trackRef: any;
}) {
  const publication = trackRef.publication;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  const [videoTrack, setVideoTrack] = useState(
    publication?.track as VideoTrack | undefined,
  );

  const isMuted = publication?.isMuted ?? false;
  const showVideo = !!videoTrack && !isMuted;
  const { getHandState } = useHandRaise();
  const handState = getHandState(trackRef.participant);

  useEffect(() => {
    const track = publication?.track as VideoTrack | undefined;
    setVideoTrack(track);

    // Lắng nghe khi track được attach
    const onSubscribed = () => {
      setVideoTrack(publication?.track as VideoTrack);
    };
    const onUnsubscribed = () => {
      setVideoTrack(undefined);
    };

    publication?.on("subscribed", onSubscribed);
    publication?.on("unsubscribed", onUnsubscribed);

    return () => {
      publication?.off("subscribed", onSubscribed);
      publication?.off("unsubscribed", onUnsubscribed);
    };
  }, [publication]);

  // Xử lý Metadata để lấy Avatar
  let avatarUrl = null;
  try {
    if (trackRef.participant.metadata) {
      const meta = JSON.parse(trackRef.participant.metadata);
      avatarUrl = meta.avatarUrl;
    }
  } catch (error) {
    console.error(error);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#111",
        borderRadius: 0,
        overflow: "hidden",
        borderWidth: isScreenShare ? 2 : 0,
        borderColor: isScreenShare ? "#3b82f6" : "transparent",
      }}
    >
      {/* VIDEO HOẶC AVATAR */}
      {showVideo ? (
        <VideoView
          style={{ flex: 1, backgroundColor: "#000" }}
          videoTrack={videoTrack}
          objectFit={isScreenShare ? "contain" : "cover"}
        />
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#111",
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
                backgroundColor: "#333",
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

      {/* BADGE GIƠ TAY */}
      {handState.isRaised && (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            backgroundColor: "rgba(245, 158, 11, 0.9)",
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
            flexDirection: "row",
            alignItems: "center",
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
          bottom: 6,
          left: 6,
          backgroundColor: "rgba(0,0,0,0.7)",
          paddingHorizontal: 6,
          paddingVertical: 4,
          borderRadius: 4,
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
            color="#ef4444"
            style={{ marginRight: 4 }}
          />
        )}
        <Text
          style={{ color: "white", fontSize: 12, fontWeight: "bold" }}
          numberOfLines={1}
        >
          {trackRef.participant.name || "Khách"} {isScreenShare && "(Chia sẻ)"}
        </Text>
      </View>
    </View>
  );
}
