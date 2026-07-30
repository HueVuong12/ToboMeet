// app/meeting/[code].tsx
import React, { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { LiveKitRoom } from "@livekit/react-native";

import MobileToolbar from "../../components/meeting/MobileToolbar";
import MobileVideoGrid from "../../components/meeting/MobileVideoGrid";
import MembersModal from "../../components/meeting/MembersModal";
import MobileChatModal from "../../components/meeting/MobileChatModal";
import MobileMeetingLobby from "../../components/meeting/MobileMeetingLobby";
import { useMeetingSession } from "../../hooks/useMeetingSession";

export default function MobileMeetingScreen() {
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const {
    code,
    LIVEKIT_URL,
    status,
    meetingData,
    customRoom,
    connectOptions,
    isDisconnecting,
    isJoining,
    camOn,
    setCamOn,
    micOn,
    setMicOn,
    cameraFacing,
    setCameraFacing,
    displayName,
    setDisplayName,
    handleJoinByCode,
    onRoomError,
    onRoomDisconnected,
  } = useMeetingSession();

  if (status === "LOADING" || isDisconnecting) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <ActivityIndicator size="large" color="#3b82f6" />
        {isDisconnecting && (
          <Text className="text-gray-400 mt-4 font-bold">
            Đang rời cuộc họp...
          </Text>
        )}
      </View>
    );
  }

  // Sảnh chờ
  if (status === "IN_LOBBY") {
    return (
      <MobileMeetingLobby
        meetingCode={code as string}
        camOn={camOn}
        setCamOn={setCamOn}
        micOn={micOn}
        setMicOn={setMicOn}
        cameraFacing={cameraFacing}
        setCameraFacing={setCameraFacing}
        displayName={displayName}
        setDisplayName={setDisplayName}
        handleJoin={handleJoinByCode}
        isJoining={isJoining}
      />
    );
  }

  if (!meetingData || !LIVEKIT_URL || !customRoom) return null;

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
      <View className="flex-1 bg-black">
        <View className="h-[70px] justify-center items-center bg-[#111] border-b border-[#333]">
          <Text className="text-gray-400 text-xs uppercase font-bold">
            Phòng họp
          </Text>
          <Text className="text-white font-bold text-base">{code}</Text>
        </View>

        <View className="flex-1">
          <MobileVideoGrid />
        </View>

        <MobileToolbar
          meetingCode={code as string}
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
          meetingCode={code as string}
        />
        <MobileChatModal
          meetingCode={code as string}
          roomId={meetingData.roomId}
          channelId={meetingData.channelId}
          visible={showChatModal}
          onClose={() => setShowChatModal(false)}
        />
      </View>
    </LiveKitRoom>
  );
}
