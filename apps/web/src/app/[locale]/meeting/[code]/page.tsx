// src/app/[locale]/meeting/[code]/page.tsx
"use client";

import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";
import { Loader2, Video, Mic, VideoOff, MicOff, LogOut } from "lucide-react";
import { useMeetingSession } from "@/hooks/useMeetingSession";

export default function MeetingPage() {
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const {
    meetingCode,
    status,
    meetingData,
    isDisconnecting,
    isJoining,
    camOn,
    setCamOn,
    micOn,
    setMicOn,
    displayName,
    setDisplayName,
    handleJoinByCode,
    handleDisconnect,
    hardwareConfig,
  } = useMeetingSession();

  if (status === "RECONNECTING") {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#111] text-white space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <div className="w-20 h-20 bg-[#222] rounded border border-[#333] shadow-2xl flex items-center justify-center z-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-tr from-blue-500/10 to-transparent"></div>
            <Loader2
              className="text-blue-400 animate-spin"
              size={36}
              strokeWidth={1.5}
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-200">
            Đang kết nối lại...
          </h2>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            Vui lòng đợi trong giây lát
          </p>
        </div>
      </div>
    );
  }

  if (status === "LOOKING_FOR_TOKEN") {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#111] text-white space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <div className="w-20 h-20 bg-[#222] rounded border border-[#333] shadow-2xl flex items-center justify-center z-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-tr from-blue-500/10 to-transparent"></div>
            <Video
              className="text-blue-400 animate-pulse"
              size={36}
              strokeWidth={1.5}
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-200">
            Chuẩn bị không gian
          </h2>
          <p className="text-gray-400 text-sm flex items-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={16} />
            Đang thiết lập kết nối...
          </p>
        </div>
      </div>
    );
  }

  if (isDisconnecting) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#111] text-white space-y-6 transition-opacity duration-500">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-2">
          <LogOut className="text-red-500 animate-pulse" size={32} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-200">
          Đang rời cuộc họp
        </h2>
        <p className="text-gray-400 text-sm flex items-center gap-2">
          <Loader2 className="animate-spin text-gray-500" size={16} />
          Đang dọn dẹp...
        </p>
      </div>
    );
  }

  if (status === "IN_LOBBY") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111] text-white font-sans p-4">
        <div className="bg-[#222] p-8 rounded shadow-2xl w-full max-w-md border border-[#333]">
          <h1 className="text-2xl font-bold text-center mb-2">
            Tham gia cuộc họp
          </h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Mã cuộc họp:{" "}
            <strong className="text-blue-400 font-mono">{meetingCode}</strong>
          </p>

          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-4 rounded-full transition-colors ${micOn ? "bg-[#333] text-white" : "bg-red-500 text-white"}`}
            >
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button
              onClick={() => setCamOn(!camOn)}
              className={`p-4 rounded-full transition-colors ${camOn ? "bg-[#333] text-white" : "bg-red-500 text-white"}`}
            >
              {camOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              Tên hiển thị của bạn
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên của bạn"
              className="w-full bg-[#111] border border-[#444] rounded px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <button
            onClick={handleJoinByCode}
            disabled={isJoining}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isJoining ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Tham gia phòng"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!meetingData || !LIVEKIT_URL) return null;

  return (
    <LiveKitRoom
      video={camOn}
      audio={micOn}
      token={meetingData.token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      connectOptions={{
        autoSubscribe: false, // chỉ subscribe những track dùng để hiển thị
      }}
      options={{
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          deviceId: hardwareConfig.parsedCameraConfig?.deviceId,
          resolution: {
            width: hardwareConfig.parsedCameraConfig?.width,
            height: hardwareConfig.parsedCameraConfig?.height,
            frameRate: 30,
          },
        },
        ...(hardwareConfig.micId && {
          audioCaptureDefaults: { deviceId: hardwareConfig.micId },
        }),
        ...(hardwareConfig.speakerId && {
          audioOutput: { deviceId: hardwareConfig.speakerId },
        }),
      }}
      onDisconnected={handleDisconnect}
    >
      <RoomAudioRenderer />
      <MeetingRoomContent
        channelName={meetingData.channelName}
        roomId={meetingData.roomId}
        channelId={meetingData.channelId}
        meetingCode={meetingCode}
      />
    </LiveKitRoom>
  );
}
