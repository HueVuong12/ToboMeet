// app/meeting/[code].tsx
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { LiveKitRoom } from "@livekit/react-native";
import MobileMeetingLobby from "../../components/meeting/MobileMeetingLobby";
import { useMeetingSession } from "../../hooks/useMeetingSession";
import { useTranslation } from "react-i18next";
import MeetingRoomContent from "../../components/meeting/MeetingRoomContent";

export default function MobileMeetingScreen() {
  const { t } = useTranslation();
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
            {t("meeting.meeting_page.leaving_meeting")}
          </Text>
        )}
      </View>
    );
  }

  // Sảnh chờ chuẩn bị thiết bị
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
      <MeetingRoomContent
        meetingData={meetingData}
        meetingCode={code as string}
        handleDisconnect={() => customRoom.disconnect()}
      />
    </LiveKitRoom>
  );
}
