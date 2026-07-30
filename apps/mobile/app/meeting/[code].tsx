// app/meeting/[code].tsx
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { LiveKitRoom } from "@livekit/react-native";

import MobileToolbar from "../../components/meeting/MobileToolbar";
import MobileVideoGrid from "../../components/meeting/MobileVideoGrid";
import MembersModal from "../../components/meeting/MembersModal";
import MobileChatModal from "../../components/meeting/MobileChatModal";
import { useMeetingSession } from "../../hooks/useMeetingSession";

export default function MobileMeetingScreen() {
  const {
    code,
    LIVEKIT_URL,
    meetingData,
    customRoom,
    connectOptions,
    isDisconnecting,
    showMembersModal,
    setShowMembersModal,
    showChatModal,
    setShowChatModal,
    onRoomError,
    onRoomDisconnected,
  } = useMeetingSession();

  // Màn hình chờ thoát
  if (isDisconnecting) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#9ca3af" />
        <Text style={{ color: "#9ca3af", marginTop: 16, fontWeight: "bold" }}>
          Đang rời cuộc họp...
        </Text>
      </View>
    );
  }

  // Màn hình chờ khởi tạo phòng
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
      onError={onRoomError}
      onDisconnected={onRoomDisconnected}
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
            meetingData.cameraFacing === "back" ? "environment" : "user"
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
