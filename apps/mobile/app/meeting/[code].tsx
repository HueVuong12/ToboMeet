// app/meeting/[code].tsx

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MeetingPayload, MeetingStore } from "../../lib/meetingStore";

// LIVEKIT COMPONENTS
import { LiveKitRoom } from "@livekit/react-native";
import MobileVideoGrid from "../../components/meeting/MobileVideoGrid";
import MobileToolbar from "../../components/meeting/MobileToolbar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MembersModal from "../../components/meeting/MembersModal";

// MÀN HÌNH CHÍNH
export default function MobileMeetingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  const [meetingData, setMeetingData] = useState<MeetingPayload | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);

  useEffect(() => {
    const data = MeetingStore.get();
    if (data) {
      setMeetingData(data);
      MeetingStore.clear();
    }
  }, []);

  // Luôn chạy khi màn hình bị đóng
  useEffect(() => {
    return () => {
      if (meetingData?.roomId) {
        AsyncStorage.removeItem(`active_meeting_${meetingData.roomId}`);
      }
    };
  }, [meetingData?.roomId]);

  const roomOptions = useMemo(() => {
    return {
      videoCaptureDefaults: {
        // Dịch ngôn ngữ: "front" -> "user", "back" -> "environment"
        facingMode: (meetingData?.cameraFacing === "back"
          ? "environment"
          : "user") as "user" | "environment",
      },
    };
  }, [meetingData?.cameraFacing]);

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
        <ActivityIndicator size="large" color="#3b82f6" />
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
      options={roomOptions}
      onDisconnected={async () => {
        if (meetingData?.roomId) {
          await AsyncStorage.removeItem(`active_meeting_${meetingData.roomId}`);
        }

        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/home");
        }
      }}
    >
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        <View
          style={{
            height: 90,
            paddingTop: 40,
            justifyContent: "center",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.05)",
          }}
        >
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            Phòng họp
          </Text>
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
            {code}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <MobileVideoGrid />
        </View>

        <MobileToolbar
          initialFacingMode={roomOptions.videoCaptureDefaults.facingMode}
          onOpenMembers={() => setShowMembersModal(true)}
          onOpenChat={() => Alert.alert("Thông báo", "Mở khung chat...")}
        />

        <MembersModal
          visible={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          roomId={meetingData.roomId}
          channelId={meetingData.channelId}
          meetingCode={code}
        />
      </View>
    </LiveKitRoom>
  );
}
