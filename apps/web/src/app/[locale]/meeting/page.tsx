// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";

export default function MeetingPage() {
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const channelName = searchParams.get("channelName");
  const roomId = searchParams.get("roomId");
  const channelId = searchParams.get("channelId");
  const meetingCode = searchParams.get("meetingCode");

  const initialCam = searchParams.get("cam") !== "false";
  const initialMic = searchParams.get("mic") === "true";

  // Parse các thiết bị từ URL
  const micId = searchParams.get("micId");
  const speakerId = searchParams.get("speakerId");
  const cameraConfig = searchParams.get("cameraConfig");
  const parsed = cameraConfig
    ? JSON.parse(decodeURIComponent(cameraConfig))
    : null;

  if (!token || !LIVEKIT_URL) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1f1f1f] text-white font-sans">
        Lỗi: Thiếu Token hoặc Server URL
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={initialCam}
      audio={initialMic}
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      options={{
        // Cấu hình Camera
        videoCaptureDefaults: {
          deviceId: parsed?.deviceId,
          resolution: {
            width: parsed?.width,
            height: parsed?.height,
            frameRate: 30,
          },
        },
        // Cấu hình Micro
        ...(micId && {
          audioCaptureDefaults: {
            deviceId: micId,
          },
        }),
        // Cấu hình Loa / Tai nghe
        ...(speakerId && {
          audioOutput: {
            deviceId: speakerId,
          },
        }),
      }}
      onDisconnected={() => {
        window.close();
      }}
    >
      <MeetingRoomContent
        channelName={channelName}
        roomId={roomId}
        channelId={channelId}
        meetingCode={meetingCode}
      />
    </LiveKitRoom>
  );
}
