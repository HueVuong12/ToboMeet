// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";
import { Loader2, Video, Mic, VideoOff, MicOff } from "lucide-react";
import { useJoinMeetingByCodeMutation } from "@/lib/redux/api/meetingsApi";

export default function MeetingPage() {
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const searchParams = useSearchParams();
  const params = useParams();

  const meetingCode = params.code as string;

  // Thiết bị
  const [camOn, setCamOn] = useState(searchParams.get("cam") !== "false");
  const [micOn, setMicOn] = useState(searchParams.get("mic") === "true");
  const [displayName, setDisplayName] = useState("");

  const micId = searchParams.get("micId");
  const speakerId = searchParams.get("speakerId");
  const cameraConfig = searchParams.get("cameraConfig");
  const parsed = cameraConfig
    ? JSON.parse(decodeURIComponent(cameraConfig))
    : null;

  // Dữ liệu ẩn và Trạng thái
  const [meetingData, setMeetingData] = useState<{
    token: string;
    roomId: string;
    channelId: string;
    channelName: string;
  } | null>(null);

  const [status, setStatus] = useState<
    "LOOKING_FOR_TOKEN" | "IN_LOBBY" | "JOINED"
  >("LOOKING_FOR_TOKEN");
  const [joinMeetingByCodeApi, { isLoading: isJoining }] =
    useJoinMeetingByCodeMutation();

  // LOGIC TÌM TOKEN (TỪ CHỦ PHÒNG) HOẶC RƠI VÀO PHÒNG CHỜ
  useEffect(() => {
    if (!meetingCode) return;
    const bc = new BroadcastChannel(`token_channel_${meetingCode}`);

    bc.onmessage = (event) => {
      if (event.data?.type === "TOKEN_PAYLOAD") {
        setMeetingData({
          token: event.data.token,
          roomId: event.data.roomId,
          channelId: event.data.channelId,
          channelName: event.data.channelName,
        });
        setStatus("JOINED");
        bc.close();
      }
    };

    // Báo hiệu xin Token
    bc.postMessage("TAB_B_READY");

    // Timeout 1.5 giây -> Người dùng vào từ link chia sẻ
    const timeout = setTimeout(() => {
      if (status === "LOOKING_FOR_TOKEN") {
        setStatus("IN_LOBBY");
        bc.close();
      }
    }, 1500);

    return () => {
      bc.close();
      clearTimeout(timeout);
    };
  }, [meetingCode, status]);

  // KHÁCH (GUEST) GỌI API LẤY VÉ VÀO CỬA
  const handleJoinFromLink = async () => {
    if (!meetingCode) return;
    try {
      const response = await joinMeetingByCodeApi({
        meetingCode,
        displayName: displayName || undefined,
      }).unwrap();

      setMeetingData({
        token: response.token,
        roomId: response.roomId,
        channelId: response.channelId,
        channelName: response.channelName,
      });
      setStatus("JOINED");
    } catch (error) {
      alert("Mã cuộc họp không hợp lệ hoặc cuộc họp đã kết thúc.");
    }
  };

  if (status === "LOOKING_FOR_TOKEN") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1f1f1f] text-white">
        Đang tải cấu hình...
      </div>
    );
  }

  // PHÒNG CHỜ (LOBBY)
  if (status === "IN_LOBBY") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white font-sans p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
          <h1 className="text-2xl font-bold text-center mb-2">
            Tham gia cuộc họp
          </h1>
          <p className="text-slate-400 text-sm text-center mb-6">
            Mã cuộc họp:{" "}
            <strong className="text-brand-400 font-mono">{meetingCode}</strong>
          </p>

          <div className="flex justify-center gap-4 mb-6">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-4 rounded-full transition-colors ${micOn ? "bg-slate-700 text-white" : "bg-red-500 text-white"}`}
            >
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button
              onClick={() => setCamOn(!camOn)}
              className={`p-4 rounded-full transition-colors ${camOn ? "bg-slate-700 text-white" : "bg-red-500 text-white"}`}
            >
              {camOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-2">
              Tên hiển thị của bạn
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên của bạn"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-500 text-sm"
            />
          </div>

          <button
            onClick={handleJoinFromLink}
            disabled={isJoining}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
      token={meetingData.token} // Lấy token từ RAM (State)
      serverUrl={LIVEKIT_URL}
      connect={true}
      options={{
        videoCaptureDefaults: {
          deviceId: parsed?.deviceId,
          resolution: {
            width: parsed?.width,
            height: parsed?.height,
            frameRate: 30,
          },
        },
        ...(micId && { audioCaptureDefaults: { deviceId: micId } }),
        ...(speakerId && { audioOutput: { deviceId: speakerId } }),
      }}
      onDisconnected={() => window.close()}
    >
      <MeetingRoomContent
        channelName={meetingData.channelName}
        roomId={meetingData.roomId}
        channelId={meetingData.channelId}
        meetingCode={meetingCode}
      />
    </LiveKitRoom>
  );
}
