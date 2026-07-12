// app/meeting/[code].tsx

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, DeviceEventEmitter } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MeetingStore } from "../../lib/meetingStore";

// 1. IMPORT CÁC THÀNH PHẦN HIỂN THỊ VIDEO
import { LiveKitRoom, VideoView } from "@livekit/react-native";
import { useTracks } from "@livekit/components-react";
import { Track, VideoTrack } from "livekit-client";

// ==========================================
// COMPONENT CON: LƯỚI VIDEO (DÙNG ĐỂ TEST)
// ==========================================
function VideoGrid() {
  // Lấy tất cả các luồng Camera trong phòng (bao gồm cả bạn và người khác)
  const tracks = useTracks([Track.Source.Camera]);

  if (tracks.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="small" color="#64748b" />
        <Text style={{ color: "#94a3b8", marginTop: 10 }}>
          Chưa có ai bật Camera...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 4,
        alignContent: "center",
        justifyContent: "center",
      }}
    >
      {tracks.map((trackRef) => {
        // Ép kiểu để lấy đúng đối tượng VideoTrack truyền vào VideoView
        const videoTrack = trackRef.publication?.track as VideoTrack;

        return (
          <View
            key={trackRef.participant.identity}
            style={{ width: "50%", aspectRatio: 3 / 4, padding: 4 }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: "#1e293b",
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#334155",
              }}
            >
              {/* NẾU CÓ ĐỦ DỮ LIỆU THÌ HIỂN THỊ VIDEO */}
              {videoTrack ? (
                <VideoView
                  style={{ flex: 1 }}
                  videoTrack={videoTrack}
                  objectFit="cover"
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#64748b" }}>Đang tải...</Text>
                </View>
              )}

              {/* TÊN NGƯỜI DÙNG HIỂN THỊ GÓC TRÁI */}
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{ color: "white", fontSize: 12, fontWeight: "bold" }}
                  numberOfLines={1}
                >
                  {trackRef.participant.name || "Khách"}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ==========================================
// MÀN HÌNH CHÍNH
// ==========================================
export default function MobileMeetingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  const [meetingData, setMeetingData] = useState<{
    token: string;
    roomId: string;
    channelId: string;
    isCamOn: boolean;
    isMicOn: boolean;
  } | null>(null);

  useEffect(() => {
    const handleForceClose = (eventRoomId: string) => {
      // Khi nhận được tín hiệu nhường thiết bị, tự động lùi về màn hình Chat trước đó
      console.log("Đã nhường thiết bị, tự động đóng phòng họp...");

      // router.back() sẽ bốc màn hình Meeting ra khỏi Stack, trả bạn về đúng phòng Chat
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/home");
      }
    };

    // Đăng ký lắng nghe
    const subscription = DeviceEventEmitter.addListener(
      "FORCE_CLOSE_MEETING_WINDOW",
      handleForceClose,
    );

    return () => {
      // Hủy lắng nghe khi Component bị hủy (rất quan trọng để tránh rò rỉ bộ nhớ)
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const data = MeetingStore.get();
    if (data) {
      setMeetingData(data);
      MeetingStore.clear();
    }
  }, []);

  if (!meetingData || !LIVEKIT_URL) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0f172a",
        }}
      >
        <Text style={{ color: "white" }}>Đang kết nối...</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={meetingData.token}
      connect={true}
      video={meetingData.isCamOn}
      audio={meetingData.isMicOn}
    >
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        {/* THANH HEADER ĐƠN GIẢN */}
        <View
          style={{
            height: 50,
            justifyContent: "center",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "#1e293b",
            marginTop: 40,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
            Phòng: {code}
          </Text>
        </View>

        {/* NHÚNG COMPONENT LƯỚI VIDEO VÀO ĐÂY */}
        <VideoGrid />
      </View>
    </LiveKitRoom>
  );
}
