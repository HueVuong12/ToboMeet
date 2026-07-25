// app/meeting/[code].tsx

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MeetingPayload, MeetingStore } from "../../lib/meetingStore";

import { LiveKitRoom, AudioSession } from "@livekit/react-native";
import { Room } from "livekit-client";

import MobileToolbar from "../../components/meeting/MobileToolbar";
import MobileVideoGrid from "../../components/meeting/MobileVideoGrid";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MembersModal from "../../components/meeting/MembersModal";
import MobileChatModal from "../../components/meeting/MobileChatModal";
import { toast } from "../../lib/toast";

export default function MobileMeetingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  const [meetingData, setMeetingData] = useState<MeetingPayload | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [customRoom, setCustomRoom] = useState<Room | null>(null);

  useEffect(() => {
    const data = MeetingStore.get();
    if (data) {
      setMeetingData(data);
      MeetingStore.clear();
    }

    const configureAudio = async () => {
      try {
        await AudioSession.startAudioSession();
      } catch (error) {
        console.error("Lỗi khi khởi động hệ thống âm thanh:", error);
        toast.error("Lỗi khi khởi động hệ thống âm thanh");
      }
    };
    configureAudio();
  }, []);

  useEffect(() => {
    return () => {
      if (meetingData?.roomId) {
        AsyncStorage.removeItem(`active_meeting_${meetingData.roomId}`);
      }
    };
  }, [meetingData?.roomId]);

  useEffect(() => {
    if (!meetingData) return;

    const roomInstance = new Room({
      adaptiveStream: false,
      dynacast: true,
      videoCaptureDefaults: {
        facingMode: (meetingData.cameraFacing === "back"
          ? "environment"
          : "user") as "user" | "environment",
      },
    });

    setCustomRoom(roomInstance);

    return () => {
      roomInstance.disconnect();
    };
  }, [meetingData]);

  // Cấu hình lúc kết nối
  const connectOptions = useMemo(() => {
    return {
      autoSubscribe: false, // Quan trọng nhất để ko bị lag
    };
  }, []);

  // Chờ cho cả meetingData và customRoom được khởi tạo xong
  if (!meetingData || !LIVEKIT_URL || !customRoom) {
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
      </View>
    );
  }

  return (
    <LiveKitRoom
      room={customRoom}
      serverUrl={LIVEKIT_URL}
      token={meetingData.token}
      connect={true}
      video={meetingData.isCamOn}
      audio={meetingData.isMicOn}
      connectOptions={connectOptions}
      onError={(error) => {
        console.error("Bắt được lỗi WebRTC:", error);
        customRoom.disconnect();
      }}
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
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            height: 70,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#111",
            borderBottomWidth: 1,
            borderBottomColor: "#333",
          }}
        >
          <Text
            style={{
              color: "#9ca3af",
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
          meetingCode={code}
          roomId={meetingData.roomId}
          channelId={meetingData.channelId}
          initialFacingMode={
            meetingData?.cameraFacing === "back" ? "environment" : "user"
          }
          onOpenMembers={() => setShowMembersModal(true)}
          onOpenChat={() => setShowChatModal(true)}
        />

        <MembersModal
          visible={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          roomId={meetingData.roomId}
          channelId={meetingData.channelId}
          meetingCode={code}
        />
        <MobileChatModal
          meetingCode={code}
          roomId={meetingData.roomId}
          channelId={meetingData.channelId}
          visible={showChatModal}
          onClose={() => setShowChatModal(false)}
        />
      </View>
    </LiveKitRoom>
  );
}
