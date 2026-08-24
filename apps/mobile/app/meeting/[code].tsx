// app/meeting/[code].tsx
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { LiveKitRoom } from "@livekit/react-native";
import MobileMeetingLobby from "../../components/meeting/MobileMeetingLobby";
import {
  MeetingSessionProvider,
  useMeetingSessionContext,
} from "../../components/meeting/contexts/MeetingSessionContext";
import { useTranslation } from "react-i18next";
import MeetingRoomContent from "../../components/meeting/MeetingRoomContent";

function MobileMeetingContent() {
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
    handleSmartRedirect,
    onRoomError,
    onRoomDisconnected,
  } = useMeetingSessionContext();

  const isLoadingState =
    status === "LOADING" ||
    status === "SWITCHING_BREAKOUT" ||
    status === "RETURNING_TO_MAIN" ||
    isDisconnecting;

  if (isLoadingState) {
    let loadingDesc = "";
    if (isDisconnecting) {
      loadingDesc = t("meeting.meeting_page.leaving_meeting", {
        defaultValue: "Đang rời cuộc họp...",
      });
    } else if (status === "SWITCHING_BREAKOUT") {
      loadingDesc = t("meeting.meeting_page.loading_joining_breakout", {
        defaultValue: "Đang tham gia nhóm thảo luận...",
      });
    } else if (status === "RETURNING_TO_MAIN") {
      loadingDesc = t("meeting.meeting_page.loading_returning_main", {
        defaultValue: "Đang quay về phòng chính...",
      });
    }

    return (
      <View className="flex-1 justify-center items-center bg-[#09090b]">
        <ActivityIndicator size="large" color="#0052FF" />
        {loadingDesc ? (
          <Text className="text-gray-400 mt-4 font-bold">{loadingDesc}</Text>
        ) : null}
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
        onBack={handleSmartRedirect}
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

export default function MobileMeetingScreen() {
  return (
    <MeetingSessionProvider>
      <MobileMeetingContent />
    </MeetingSessionProvider>
  );
}
