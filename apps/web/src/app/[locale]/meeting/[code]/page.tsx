// src/app/[locale]/meeting/[code]/page.tsx
"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";
import { Clock, Loader2, LogOut, Smartphone } from "lucide-react";
import { useMeetingSession } from "@/hooks/useMeetingSession";
import MeetingLobby from "@/components/meeting/MeetingLobby";
import { useEffect, useState } from "react";
import { RoomEvent } from "livekit-client";
import { toast } from "sonner";

export default function MeetingPage() {
  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const {
    isAuthenticated,
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

  // GỘP CHUNG CÁC TRẠNG THÁI LOADING THÀNH 1 BIẾN
  const isLoadingState =
    isAuthenticated === null ||
    status === "LOOKING_FOR_TOKEN" ||
    status === "RECONNECTING";

  if (isLoadingState) {
    let loadingDesc = "";

    // Gán nội dung tương ứng theo trạng thái
    if (isAuthenticated === null) {
      loadingDesc = "Vui lòng đợi trong giây lát";
    } else if (status === "LOOKING_FOR_TOKEN") {
      loadingDesc = "Chuẩn bị không gian phòng họp";
    } else if (status === "RECONNECTING") {
      loadingDesc = "Đang khôi phục phiên làm việc";
    }

    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#111] text-white space-y-6">
        {/* Khai báo Keyframe CSS trực tiếp để đảm bảo luôn chạy mượt */}
        <style>{`
          @keyframes slideUpFade {
            0% { opacity: 0; transform: translateY(15px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up-fade {
            animation: slideUpFade 0.4s ease-out forwards;
          }
        `}</style>

        {/* Khối chứa Text cố định chiều cao để không bị giật khung hình */}
        <div className="h-20 flex flex-col items-center justify-start overflow-hidden">
          {/* Thuộc tính key={loadingTitle} chính là chìa khóa để hiệu ứng slide-up chạy lại mỗi khi Text đổi */}
          <div
            key={loadingDesc}
            className="flex flex-col items-center animate-slide-up-fade"
          >
            <p className="text-gray-400 text-sm mt-2 flex items-center gap-2">
              <Loader2 className="animate-spin text-blue-500" size={16} />
              {loadingDesc}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Chưa đăng nhập
  if (isAuthenticated === false) {
    return <UnauthenticatedView meetingCode={meetingCode} />;
  }

  // Rời phòng
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

  // Sảnh chờ (chuẩn bị mic/cam nếu tham gia bằng link, đợi chủ phòng duyệt)
  if (status === "IN_LOBBY") {
    return (
      <MeetingLobby
        meetingCode={meetingCode}
        displayName={displayName}
        setDisplayName={setDisplayName}
        camOn={camOn}
        setCamOn={setCamOn}
        micOn={micOn}
        setMicOn={setMicOn}
        handleJoinByCode={handleJoinByCode}
        isJoining={isJoining}
      />
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
            width: hardwareConfig.parsedCameraConfig?.width ?? 1280,
            height: hardwareConfig.parsedCameraConfig?.height ?? 720,
            frameRate: 30,
          },
        },
        ...(hardwareConfig.micId && {
          audioCaptureDefaults: {
            deviceId: hardwareConfig.micId,
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
          },
        }),
        ...(hardwareConfig.speakerId && {
          audioOutput: { deviceId: hardwareConfig.speakerId },
        }),
      }}
      onDisconnected={handleDisconnect}
    >
      <RoomAudioRenderer volume={1.0} />
      <RoomContentGuard
        meetingData={meetingData}
        meetingCode={meetingCode}
        handleDisconnect={handleDisconnect}
      />
    </LiveKitRoom>
  );
}

function RoomContentGuard({ meetingData, meetingCode, handleDisconnect }: any) {
  const room = useRoomContext();

  // Lấy trạng thái NGAY LẬP TỨC từ JWT Token (Không chờ LiveKit connect)
  const [participantStatus, setParticipantStatus] = useState(() => {
    try {
      const base64Url = meetingData.token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      );
      const payload = JSON.parse(jsonPayload);

      if (payload.metadata) {
        const meta = JSON.parse(payload.metadata);
        return meta.status || "joined";
      }
    } catch (e) {
      console.error("Lỗi parse JWT:", e);
    }
    return "joined";
  });

  // Lắng nghe sự kiện Metadata bị thay đổi (Khi Chủ phòng bấm Duyệt)
  useEffect(() => {
    const handleMetadataChanged = (
      prevMetadata: string | undefined, // Đây là Metadata CŨ trước khi thay đổi
      participant: any, // Object participant chứa Metadata MỚI
    ) => {
      // Chỉ update UI nếu người bị thay đổi metadata chính là User hiện tại
      if (participant.identity === room.localParticipant?.identity) {
        try {
          if (participant.metadata) {
            const meta = JSON.parse(participant.metadata);

            if (meta.status && meta.status === "joined") {
              toast.success("Chủ phòng đã phê duyệt bạn vào cuộc họp.");
            }

            if (meta.status) {
              setParticipantStatus(meta.status);
            }
          }
        } catch (e) {
          console.error("Lỗi parse metadata:", e);
        }
      }
    };

    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    };
  }, [room]);

  // Hiện thị giao diện sảnh chờ nếu trạng thái là "waiting"
  if (participantStatus === "waiting") {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-4 transition-all duration-500 animate-fade-in">
        <div className="w-24 h-24 mb-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center relative">
          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500/20 animate-ping"></span>
          <Clock className="w-10 h-10 text-amber-500 relative z-10" />
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white mb-3 tracking-wide">
          Vui lòng chờ
        </h1>
        <p className="text-gray-400 text-center max-w-md text-sm leading-relaxed mb-8">
          Chủ phòng đã nhận được yêu cầu tham gia của bạn. Bạn sẽ tự động được
          đưa vào cuộc họp ngay khi chủ phòng phê duyệt.
        </p>
        <button
          onClick={handleDisconnect}
          className="px-6 py-2.5 bg-[#222] hover:bg-[#333] text-gray-300 rounded-xl text-sm font-medium transition-colors border border-[#333] hover:text-white"
        >
          Rời khỏi phòng chờ
        </button>
      </div>
    );
  }

  return (
    <MeetingRoomContent
      channelName={meetingData.channelName}
      roomId={meetingData.roomId}
      channelId={meetingData.channelId}
      meetingCode={meetingCode}
    />
  );
}

function UnauthenticatedView({ meetingCode }: { meetingCode: string }) {
  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 lg:p-8 font-sans transition-colors duration-700">
      {/* Khai báo Keyframes CSS cho hiệu ứng mượt mà */}
      <style>{`
        @keyframes smoothFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes slideUpStagger {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: smoothFadeIn 0.8s ease-out forwards;
        }
        .animate-slide-up-1 {
          opacity: 0;
          animation: slideUpStagger 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
        }
        .animate-slide-up-2 {
          opacity: 0;
          animation: slideUpStagger 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
        }
        .animate-slide-up-3 {
          opacity: 0;
          animation: slideUpStagger 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
        }
      `}</style>

      <div className="bg-[#222] rounded-3xl shadow-2xl border border-[#333] w-full max-w-md p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20 animate-slide-up-1">
          <Smartphone className="text-blue-500 w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-3 animate-slide-up-1">
          Tham gia cuộc họp
        </h1>
        <p className="text-slate-400 text-sm mb-8 animate-slide-up-2">
          Bạn chưa đăng nhập. Để trải nghiệm cuộc họp tốt nhất, hãy mở ứng dụng
          ToboMeet trên điện thoại hoặc đăng nhập trên web để tiếp tục.
        </p>

        <div className="flex flex-col gap-4 animate-slide-up-3">
          <a
            href={`intent://meeting/${meetingCode}#Intent;scheme=tobomeet;package=com.hng209.mobile;end;`}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm"
          >
            Mở ToboMeet App
          </a>

          <a
            href={`/login?redirect=/meeting/${meetingCode}`}
            className="w-full bg-[#333] hover:bg-[#444] text-white py-3.5 rounded-xl font-bold shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm border border-[#444]"
          >
            Đăng nhập trên Web
          </a>
        </div>
      </div>
    </div>
  );
}
