// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";
import { Loader2, Video, Mic, VideoOff, MicOff, LogOut } from "lucide-react";
import { useJoinMeetingByCodeMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useMeetingCacheManager } from "@/hooks/useMeetingCacheManager";

export default function MeetingPage() {
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const searchParams = useSearchParams();
  const params = useParams();
  const deviceId = useDeviceId();
  const { clearMeetingDeviceStatus } = useMeetingCacheManager();

  const meetingCode = params.code as string;

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
  const hasTriedReconnectRef = useRef(false);

  const [status, setStatus] = useState<
    "LOOKING_FOR_TOKEN" | "IN_LOBBY" | "JOINED" | "RECONNECTING"
  >("LOOKING_FOR_TOKEN");
  const [joinMeetingByCodeApi, { isLoading: isJoining }] =
    useJoinMeetingByCodeMutation();

  const isUnloadingRef = useRef(false);

  // Lắng nghe sự kiện F5 hoặc tắt Tab của trình duyệt
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, []);

  const handleJoinByCode = useCallback(async () => {
    if (!meetingCode) return;

    if (!deviceId) {
      console.log("[Meeting] Waiting for deviceId...");
      return;
    }

    try {
      // Lấy tên từ state, nếu trống (do F5) thì lấy từ sessionStorage
      const savedName = sessionStorage.getItem(`meeting_name_${meetingCode}`);
      const finalName = displayName || savedName || undefined;

      const response = await joinMeetingByCodeApi({
        meetingCode,
        deviceId: deviceId,
        displayName: finalName,
      }).unwrap();

      sessionStorage.setItem(`is_joined_${meetingCode}`, "true");
      if (finalName) {
        sessionStorage.setItem(`meeting_name_${meetingCode}`, finalName);
      }

      setMeetingData({
        token: response.token,
        roomId: response.roomId,
        channelId: response.channelId,
        channelName: response.channelName,
      });

      setStatus("JOINED");
      hasTriedReconnectRef.current = false;
    } catch (error: any) {
      // Nếu xin Token thất bại (ví dụ: phòng đã khóa/kết thúc), xóa cờ và văng ra Lobby
      sessionStorage.removeItem(`is_joined_${meetingCode}`);
      hasTriedReconnectRef.current = false;

      if (error?.code === 4013) {
        toast.error("Bạn đang ở trong phòng này trên thiết bị/tab khác.");
      } else {
        toast.error("Không thể kết nối lại cuộc họp. Vui lòng thử lại.");
        setStatus("IN_LOBBY");
      }
    }
  }, [meetingCode, displayName, deviceId, joinMeetingByCodeApi]);

  // Kiểm tra Session hoặc xin Token qua BroadcastChannel
  useEffect(() => {
    if (!meetingCode || status !== "LOOKING_FOR_TOKEN") return;

    // Nếu trước đó đã join nhưng bị refresh trang
    const isJoined = sessionStorage.getItem(`is_joined_${meetingCode}`);

    if (isJoined) {
      setStatus("RECONNECTING");
      return;
    }

    // BROADCAST CHANNEL (Mở tab mới từ hệ thống)
    const bc = new BroadcastChannel(`token_channel_${meetingCode}`);

    bc.onmessage = (event) => {
      if (event.data?.type === "TOKEN_PAYLOAD") {
        // Lưu cờ vào session để đánh dấu tab này đã join
        sessionStorage.setItem(`is_joined_${meetingCode}`, "true");

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

    // Timeout 1.5 giây -> Nếu không có tín hiệu thì ra Lobby
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
  }, [meetingCode, status, handleJoinByCode]);

  // khi RECONNECTING + deviceId sẵn sàng → join
  useEffect(() => {
    if (status !== "RECONNECTING") return;
    if (!deviceId) return; // vẫn đợi
    if (hasTriedReconnectRef.current) return; // đã thử rồi

    hasTriedReconnectRef.current = true;
    handleJoinByCode();
  }, [status, deviceId, handleJoinByCode]);

  const handleDisconnect = () => {
    if (isUnloadingRef.current) return;

    setIsDisconnecting(true);

    setTimeout(() => {
      sessionStorage.removeItem(`is_joined_${meetingCode}`);
      sessionStorage.removeItem(`meeting_name_${meetingCode}`);

      if (meetingData) {
        clearMeetingDeviceStatus(meetingData?.roomId, meetingData?.channelId);
        const syncChannel = new BroadcastChannel(
          `meeting_sync_${meetingData.roomId}`,
        );
        syncChannel.postMessage({
          type: "MEETING_DISCONNECTED",
          channelId: meetingData.channelId,
        });
        syncChannel.close();
      }

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
