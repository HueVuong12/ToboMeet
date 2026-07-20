// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";
import { Loader2, Video, Mic, VideoOff, MicOff, LogOut } from "lucide-react";
import { useJoinMeetingByCodeMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";

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

  const [meetingData, setMeetingData] = useState<{
    token: string;
    roomId: string;
    channelId: string;
    channelName: string;
  } | null>(null);

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [status, setStatus] = useState<
    "LOOKING_FOR_TOKEN" | "IN_LOBBY" | "JOINED"
  >("LOOKING_FOR_TOKEN");
  const [joinMeetingByCodeApi, { isLoading: isJoining }] =
    useJoinMeetingByCodeMutation();

  // Logic tìm token hoặc vào phòng chờ (Lobby)
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

  // Tham gia bằng link, dùng cho cả khách bên ngoài hoặc người trong phòng
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

      localStorage.setItem(
        `active_meeting_${response.roomId}`,
        response.channelId,
      );

      setStatus("JOINED");
    } catch (error: any) {
      // Code 4013: Đang có thiết bị khác trong cuộc họp
      if (error?.code === 4013) {
        toast.error("Bạn đang ở trong phòng này trên thiết bị/tab khác.");
        // Không cần hỏi chuyển thiết bị
      } else {
        toast.error("Không thể tham gia cuộc họp lúc này.");
      }
    }
  };

  const handleDisconnect = () => {
    setIsDisconnecting(true);
    if (meetingData)
      localStorage.removeItem(`active_meeting_${meetingData.roomId}`);

    setTimeout(() => {
      window.close();

      // Fallback chuyển hướng nếu window.close() bị chặn
      setTimeout(() => {
        if (meetingData?.roomId) {
          window.location.href = `/room/${meetingData.roomId}`;
        } else {
          window.location.href = "/";
        }
      }, 300);
    }, 1000);
  };

  if (status === "LOOKING_FOR_TOKEN") {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-950 text-white space-y-6">
        <div className="relative flex items-center justify-center">
          {/* Hiệu ứng ánh sáng tỏa ra phía sau */}
          <div className="absolute inset-0 bg-brand-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          {/* Icon Video nằm giữa */}
          <div className="w-20 h-20 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl flex items-center justify-center z-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 to-transparent"></div>
            <Video
              className="text-brand-400 animate-pulse"
              size={36}
              strokeWidth={1.5}
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-200">
            Chuẩn bị không gian
          </h2>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Loader2 className="animate-spin text-brand-500" size={16} />
            Đang thiết lập kết nối...
          </p>
        </div>
      </div>
    );
  }

  if (isDisconnecting) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-950 text-white space-y-6 transition-opacity duration-500">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mb-2">
          <LogOut className="text-red-500 animate-pulse" size={32} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-200">
          Đang rời cuộc họp
        </h2>
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <Loader2 className="animate-spin text-slate-500" size={16} />
          Đang dọn dẹp...
        </p>
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
        adaptiveStream: true,
        dynacast: true,
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
