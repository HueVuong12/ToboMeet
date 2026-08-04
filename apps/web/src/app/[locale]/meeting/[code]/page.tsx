// src/app/[locale]/meeting/[code]/page.tsx
"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import MeetingRoomContent from "@/components/meeting/MeetingRoomContent";
import { Loader2, Smartphone } from "lucide-react";
import { useMeetingSession } from "@/hooks/useMeetingSession";
import MeetingLobby from "@/components/meeting/MeetingLobby";
import { useEffect, useState } from "react";
import { RoomEvent } from "livekit-client";
import { toast } from "sonner";
import { useParticipantManager } from "@/hooks/useParticipantManager";

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

  const { displayParticipants } = useParticipantManager({
    roomId: meetingData.roomId,
    channelId: meetingData.channelId,
    meetingCode: meetingCode,
  });

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

  useEffect(() => {
    const handleMetadataChanged = (
      prevMetadata: string | undefined,
      participant: any,
    ) => {
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

  if (participantStatus === "waiting") {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center p-4 transition-all duration-500 animate-fade-in">
        <style>{`
          @keyframes bounce-dot {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-6px); opacity: 1; }
          }
          .animate-dot-1 { animation: bounce-dot 1.4s infinite ease-in-out both; animation-delay: -0.32s; }
          .animate-dot-2 { animation: bounce-dot 1.4s infinite ease-in-out both; animation-delay: -0.16s; }
          .animate-dot-3 { animation: bounce-dot 1.4s infinite ease-in-out both; }
        `}</style>

        <div className="flex items-end mb-3">
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-wide">
            Vui lòng chờ
          </h1>
          <div className="flex space-x-1.5 ml-3 mb-1.5 lg:mb-2 lg:ml-4">
            <span className="w-2 h-2 lg:w-2.5 lg:h-2.5 bg-white rounded-full animate-dot-1"></span>
            <span className="w-2 h-2 lg:w-2.5 lg:h-2.5 bg-white rounded-full animate-dot-2"></span>
            <span className="w-2 h-2 lg:w-2.5 lg:h-2.5 bg-white rounded-full animate-dot-3"></span>
          </div>
        </div>

        <p className="text-gray-400 text-center max-w-md text-sm leading-relaxed mb-4 mt-2">
          Chủ phòng đã nhận được yêu cầu tham gia của bạn. Bạn sẽ tự động được
          đưa vào cuộc họp ngay khi được phê duyệt.
        </p>

        {/* HIỂN THỊ TỐI ĐA 5 NGƯỜI */}
        {displayParticipants.length > 0 ? (
          <div className="w-full max-w-lg mb-8 bg-[#1a1a1a] rounded-2xl p-5 border border-[#333] shadow-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5 text-center">
              Đang trong cuộc họp
            </h3>

            <div className="flex flex-wrap justify-center gap-4">
              {displayParticipants.slice(0, 5).map((p) => {
                let avatarUrl = "";
                try {
                  if (p.metadata) {
                    const meta = JSON.parse(p.metadata);
                    avatarUrl = meta.avatarUrl;
                  }
                } catch (e) {}

                return (
                  <div
                    key={p.identity}
                    className="flex flex-col items-center gap-2 w-16 group"
                  >
                    <div className="relative">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={p.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-[#333] group-hover:border-brand-500 transition-colors"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 border-2 border-[#333] group-hover:border-brand-500 transition-colors uppercase">
                          {p.name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1a1a1a] rounded-full"></div>
                    </div>
                    <span className="text-[10px] text-slate-300 text-center truncate w-full px-1">
                      {p.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* DÒNG CHỮ HIỂN THỊ SỐ NGƯỜI CÒN LẠI */}
            {displayParticipants.length > 5 && (
              <div className="mt-5 text-center text-xs font-medium text-slate-400">
                ...và {displayParticipants.length - 5} người đang ở trong cuộc
                họp
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center mb-4">
            Không có ai trong cuộc họp
          </p>
        )}

        <button
          onClick={handleDisconnect}
          className="px-6 py-2.5 bg-[#222] hover:bg-[#333] text-gray-300 rounded-xl text-sm font-medium transition-colors border border-[#333] hover:text-white"
        >
          Rời phòng chờ
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
