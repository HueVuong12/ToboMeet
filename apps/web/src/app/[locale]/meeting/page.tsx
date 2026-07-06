// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";

export default function MeetingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const channelName = searchParams.get("channelName");
  const roomId = searchParams.get("roomId");
  const channelId = searchParams.get("channelId");
  const meetingCode = searchParams.get("meetingCode");

  const initialCam = searchParams.get("cam") !== "false";
  const initialMic = searchParams.get("mic") === "true";
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

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
