// app/meeting/[code].tsx

import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { MeetingStore } from "../../lib/meetingStore";
import { LiveKitRoom } from "@livekit/react-native";

export default function MobileMeetingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  // Load cấu hình
  const [meetingData, setMeetingData] = useState<{
    token: string;
    roomId: string;
    channelId: string;
    isCamOn: boolean;
    isMicOn: boolean;
  } | null>(null);

  useEffect(() => {
    const data = MeetingStore.get();

    if (data) {
      setMeetingData(data);
      MeetingStore.clear(); // Xóa khỏi RAM sau khi đã lưu vào State thành công
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
        {/* Component hiển thị Video lưới hoặc Toolbar sẽ nằm ở đây */}
        <Text style={{ color: "white" }}>Đang trong phòng họp: {code}</Text>
      </View>
    </LiveKitRoom>
  );
}
