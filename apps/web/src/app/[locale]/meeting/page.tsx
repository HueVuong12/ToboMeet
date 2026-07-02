"use client";

import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  useTracks,
  GridLayout,
  ParticipantTile,
  useLocalParticipant,
  TrackReference,
  TrackReferenceOrPlaceholder,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Hand,
  MessageSquare,
  MonitorUp,
  Users,
  X,
  Maximize2,
  Crown,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import "@livekit/components-styles";

export default function CustomMeetingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const channelName = searchParams.get("channelName");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "people">("chat");

  // Đọc trạng thái ban đầu của Cam và Mic (Mặc định là true nếu không có)
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
    >
      <div className="flex flex-col h-dvh w-screen bg-[#1f1f1f] text-white overflow-hidden font-sans fixed inset-0">
        <header className="h-14 shrink-0 px-4 flex items-center justify-between bg-[#1f1f1f] border-b border-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-sm font-semibold">
              {channelName || "Phòng họp"}
            </span>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative min-h-0 w-full">
          <div className="flex-1 p-2 md:p-3 flex flex-col h-full w-full">
            {/* THAY ĐỔI TẠI ĐÂY: Truyền sidebar status để grid co giãn */}
            <div className="flex-1 bg-black rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden">
              <CustomVideoGrid />
            </div>
          </div>

          {/* Khung Sidebar (Chat / Người tham gia) */}
          {isSidebarOpen && (
            <aside className="w-full sm:w-80 shrink-0 flex flex-col bg-[#252525] border-l border-slate-800 z-20 absolute sm:relative right-0 h-full">
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
                <h2 className="font-semibold text-sm">
                  {sidebarTab === "chat" ? "Trò chuyện" : "Người tham gia"}
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              {/* THAY ĐỔI Ở ĐÂY: Hiển thị ParticipantList nếu tab là 'people' */}
              <div className="flex-1 overflow-y-auto p-4">
                {sidebarTab === "chat" ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    Chưa có tin nhắn nào.
                  </div>
                ) : (
                  <ParticipantList />
                )}
              </div>
            </aside>
          )}
        </main>

        {/* 3. TOOLBAR DƯỚI ĐÁY (Cố định, không bị đẩy lên) */}
        <div className="shrink-0 w-full z-30">
          <CustomToolbar
            onToggleSidebar={(tab) => {
              if (isSidebarOpen && sidebarTab === tab) setIsSidebarOpen(false);
              else {
                setSidebarTab(tab);
                setIsSidebarOpen(true);
              }
            }}
            activeTab={isSidebarOpen ? sidebarTab : null}
          />
        </div>
      </div>
    </LiveKitRoom>
  );
}

/**
 * COMPONENT: Lưới Video Thông Minh
 */
function CustomVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [focusTrack, setFocusTrack] =
    useState<TrackReferenceOrPlaceholder | null>(null);

  useEffect(() => {
    const screenShareTrack = tracks.find(
      (t) => t.source === Track.Source.ScreenShare,
    );
    if (screenShareTrack) {
      setFocusTrack(screenShareTrack);
    } else if (focusTrack?.source === Track.Source.ScreenShare) {
      setFocusTrack(null);
    }
  }, [tracks.filter((t) => t.source === Track.Source.ScreenShare).length]);

  if (tracks.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-500">
        Đang đợi người khác tham gia...
      </div>
    );
  }

  const mainTrack = focusTrack || tracks[0];

  // [CẬP NHẬT LÕI Ở ĐÂY]
  // Lọc sidebar dựa trên Identity và Source thay vì so sánh object
  const sidebarTracks = tracks.filter(
    (t) =>
      t.participant.identity !== mainTrack.participant.identity ||
      t.source !== mainTrack.source,
  );

  const hasScreenShare = tracks.some(
    (t) => t.source === Track.Source.ScreenShare,
  );

  // KỊCH BẢN 1: Chỉ có 1 người duy nhất trong phòng (Và không có share screen)
  if (tracks.length === 1 && !hasScreenShare) {
    return (
      <div className="flex items-center justify-center h-full w-full p-4">
        <CustomTileWrapper
          trackRef={tracks[0]}
          className="w-full max-w-125 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50"
          isMain={true}
        />
      </div>
    );
  }

  // KỊCH BẢN 2: Nhiều người, không ai share screen
  if (!hasScreenShare) {
    return (
      <div className="flex flex-wrap content-center justify-center gap-4 p-4 h-full w-full overflow-y-auto">
        {tracks.map((t) => (
          <CustomTileWrapper
            key={`${t.participant.identity}_${t.source}`}
            trackRef={t}
            className="w-full max-w-100 min-w-50 flex-[1_1_300px] aspect-square rounded-2xl overflow-hidden border border-slate-700/50"
          />
        ))}
      </div>
    );
  }

  // KỊCH BẢN 3: Có người Share Screen (Bố cục 75 - 25)
  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-2 p-2">
      {/* Màn hình chính */}
      <div className="flex-3 relative bg-[#121212] rounded-lg overflow-hidden border border-slate-700/30 flex items-center justify-center">
        <CustomTileWrapper
          trackRef={mainTrack}
          className="w-full h-full"
          isMain={true}
        />
        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-[10px] flex items-center gap-1 z-20">
          <Maximize2 size={12} /> Tiêu điểm
        </div>
      </div>

      {/* Thanh danh sách phụ */}
      <div className="flex-1 min-w-50 max-h-50 md:max-h-full overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2 custom-scrollbar p-1">
        {sidebarTracks.map((t) => (
          <div
            key={`${t.participant.identity}_${t.source}`}
            onClick={() => setFocusTrack(t)}
            className="shrink-0 w-32 md:w-full aspect-square cursor-pointer hover:ring-2 ring-brand-500 rounded-xl overflow-hidden transition-all"
          >
            <CustomTileWrapper trackRef={t} className="w-full h-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * COMPONENT: Danh sách người tham gia
 */
function ParticipantList() {
  // Lấy danh sách toàn bộ người đang trong phòng
  const participants = useParticipants();

  return (
    <div className="flex flex-col gap-1 w-full h-full">
      {participants.map((p) => {
        // Giải mã metadata để lấy Avatar URL và Role
        let avatarUrl = "";
        let role = "member";
        try {
          if (p.metadata) {
            const meta = JSON.parse(p.metadata);
            avatarUrl = meta.avatarUrl;
            role = meta.role || "member";
          }
        } catch (error) {
          console.error("Lỗi parse metadata", error);
        }

        return (
          <div
            key={p.identity}
            className="flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg transition-colors group"
          >
            {/* 1. Hiển thị Avatar */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={p.name}
                  className="w-9 h-9 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-bold text-sm uppercase border border-brand-600/30">
                  {p.name?.charAt(0) || "?"}
                </div>
              )}
              {/* Chấm xanh online */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#252525] rounded-full"></div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              {/* 2. Hiển thị Tên */}
              <span className="text-sm font-medium text-slate-200 truncate">
                {p.name}{" "}
                {p.isLocal && (
                  <span className="text-slate-500 font-normal ml-1">(Bạn)</span>
                )}
              </span>

              {/* Badge hiển thị chức danh */}
              {role !== "member" && (
                <div className="flex items-center">
                  {role === "owner" ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded w-max">
                      <Crown size={10} /> Chủ phòng
                    </span>
                  ) : role === "admin" ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded w-max">
                      <Shield size={10} /> Quản trị viên
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* 3. Hiển thị trạng thái Mic */}
            <div className="shrink-0 text-slate-400">
              {p.isMicrophoneEnabled ? (
                <div className="p-1.5 bg-slate-700/50 rounded-md">
                  <Mic size={14} className="text-green-400" />
                </div>
              ) : (
                <div className="p-1.5 bg-red-500/10 rounded-md">
                  <MicOff size={14} className="text-red-400" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * COMPONENT: Thanh điều khiển (Toolbar)
 */
function CustomToolbar({
  activeTab,
  onToggleSidebar,
}: {
  activeTab: "chat" | "people" | null;
  onToggleSidebar: (tab: "chat" | "people") => void;
}) {
  // 1. Trích xuất thêm isScreenShareEnabled từ useLocalParticipant
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();

  const [isHandRaised, setIsHandRaised] = useState(false);

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  // 2. Hàm bật/tắt chia sẻ màn hình (bọc trong try-catch phòng trường hợp user ấn Hủy cấp quyền)
  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (error) {
      console.error("Lỗi khi chia sẻ màn hình:", error);
    }
  };

  const leaveMeeting = () => window.close();

  return (
    <footer className="h-auto min-h-20 sm:h-20 shrink-0 flex flex-wrap items-center justify-center sm:justify-between px-4 sm:px-6 bg-[#1f1f1f] border-t border-slate-800 z-30 gap-4 py-2 sm:py-0">
      <div className="hidden sm:flex items-center w-50">
        <span className="text-slate-400 text-sm font-medium">
          Đã mã hóa đầu cuối
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleCam}
          className={`p-3 rounded-xl transition-all ${
            isCameraEnabled
              ? "bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              : "bg-slate-800 text-slate-400 border border-slate-700/50"
          }`}
        >
          {isCameraEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
        </button>

        <button
          onClick={toggleMic}
          className={`p-3 rounded-xl transition-all ${
            isMicrophoneEnabled
              ? "bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              : "bg-slate-800 text-slate-400 border border-slate-700/50"
          }`}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* 3. Cập nhật nút Share Screen */}
        <button
          onClick={toggleScreenShare}
          title="Chia sẻ màn hình"
          className={`p-3 rounded-xl transition-all shadow-md hidden sm:block ${
            isScreenShareEnabled
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 border border-blue-500" // Trạng thái đang share
              : "bg-slate-700 hover:bg-slate-600 text-white" // Trạng thái bình thường
          }`}
        >
          <MonitorUp size={20} />
        </button>

        <button
          onClick={() => setIsHandRaised(!isHandRaised)}
          className={`p-3 rounded-xl transition-all shadow-md ${
            isHandRaised
              ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
              : "bg-slate-700 hover:bg-slate-600 text-white"
          }`}
        >
          <Hand size={20} />
        </button>

        <div className="w-px h-8 bg-slate-700 mx-1 sm:mx-2 hidden sm:block"></div>

        <button
          onClick={leaveMeeting}
          className="px-4 sm:px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 ml-2"
        >
          <PhoneOff size={18} />
          <span className="hidden sm:inline">Rời đi</span>
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 w-auto sm:w-50 justify-end">
        <button
          onClick={() => onToggleSidebar("people")}
          className={`p-2.5 rounded-lg transition-colors ${
            activeTab === "people"
              ? "bg-slate-700 text-brand-400"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          <Users size={20} />
        </button>
        <button
          onClick={() => onToggleSidebar("chat")}
          className={`p-2.5 rounded-lg transition-colors ${
            activeTab === "chat"
              ? "bg-slate-700 text-brand-400"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          <MessageSquare size={20} />
        </button>
      </div>
    </footer>
  );
}

/**
 * COMPONENT: Wrapper thông minh cho từng ô Video
 * Xử lý: Ép khung hình vuông, hiển thị Avatar khi tắt Camera
 */
function CustomTileWrapper({
  trackRef,
  className,
  isMain = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  isMain?: boolean;
}) {
  const participant = trackRef.participant;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  // Giải mã Avatar từ metadata (giống hệt logic ở ParticipantList)
  let avatarUrl = "";
  try {
    if (participant.metadata) {
      avatarUrl = JSON.parse(participant.metadata).avatarUrl;
    }
  } catch (error) {}

  // Kiểm tra xem camera có đang tắt hay không
  const isCameraOff = !isScreenShare && !participant.isCameraEnabled;

  return (
    <div className={`relative bg-[#1a1a1a] ${className}`}>
      {/* 1. Tile mặc định của LiveKit */}
      <ParticipantTile
        trackRef={trackRef}
        className="w-full h-full"
        // Nếu là màn hình Share chính thì giữ nguyên tỷ lệ (contain), còn camera thì cắt vuông (cover)
        style={{
          objectFit: isMain && isScreenShare ? "contain" : "cover",
        }}
      />

      {/* 2. Lớp Overlay hiển thị Avatar (Chỉ hiện khi tắt Camera) */}
      {isCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#1f1f1f]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.name}
              className={`${
                isMain ? "w-40 h-40" : "w-24 h-24"
              } rounded-full object-cover border-[3px] border-slate-700 shadow-xl`}
            />
          ) : (
            <div
              className={`${
                isMain ? "w-40 h-40 text-5xl" : "w-24 h-24 text-3xl"
              } rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-bold uppercase border-[3px] border-brand-600/30 shadow-xl`}
            >
              {participant.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
