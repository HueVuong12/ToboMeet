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
} from "lucide-react";
import { useEffect, useState } from "react";
import "@livekit/components-styles";

export default function CustomMeetingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const channelName = searchParams.get("channelName");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "people">("chat");

  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!token || !LIVEKIT_URL) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1f1f1f] text-white font-sans">
        Lỗi: Thiếu Token hoặc Server URL
      </div>
    );
  }

  const handleToggleSidebar = (tab: "chat" | "people") => {
    if (isSidebarOpen && sidebarTab === tab) {
      setIsSidebarOpen(false);
    } else {
      setSidebarTab(tab);
      setIsSidebarOpen(true);
    }
  };

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
    >
      <div className="flex flex-col h-[100dvh] w-screen bg-[#1f1f1f] text-white overflow-hidden font-sans fixed inset-0">
        <header className="h-14 flex-shrink-0 px-4 flex items-center justify-between bg-[#1f1f1f] border-b border-slate-800 z-10">
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
            <aside className="w-full sm:w-80 flex-shrink-0 flex flex-col bg-[#252525] border-l border-slate-800 z-20 absolute sm:relative right-0 h-full">
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
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
              <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center text-slate-500 text-sm">
                {sidebarTab === "chat"
                  ? "Chưa có tin nhắn nào."
                  : "Đang tải danh sách..."}
              </div>
            </aside>
          )}
        </main>

        {/* 3. TOOLBAR DƯỚI ĐÁY (Cố định, không bị đẩy lên) */}
        <div className="flex-shrink-0 w-full z-30">
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
 * COMPONENT: Lưới Video Thông Minh (Kiểu Google Meet)
 */
function CustomVideoGrid() {
  // Lấy tất cả tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // State quản lý track nào đang được phóng to
  const [focusTrack, setFocusTrack] =
    useState<TrackReferenceOrPlaceholder | null>(null);

  // Tự động ưu tiên ScreenShare khi có người mới bắt đầu share
  useEffect(() => {
    const screenShareTrack = tracks.find(
      (t) => t.source === Track.Source.ScreenShare,
    );
    if (screenShareTrack) {
      setFocusTrack(screenShareTrack);
    } else if (focusTrack?.source === Track.Source.ScreenShare) {
      // Nếu người đang share tắt share, bỏ focus
      setFocusTrack(null);
    }
  }, [tracks.filter((t) => t.source === Track.Source.ScreenShare).length]);

  // Nếu không có ai trong phòng
  if (tracks.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-500">
        Đang đợi người khác tham gia...
      </div>
    );
  }

  // Quyết định track hiển thị chính
  const mainTrack = focusTrack || tracks[0];
  // Danh sách các track nhỏ bên cạnh (loại bỏ track chính)
  const sidebarTracks = tracks.filter((t) => t !== mainTrack);

  // Nếu chỉ có 1-2 người và không có share screen -> Hiển thị lưới đều (Grid)
  if (
    tracks.length <= 2 &&
    !tracks.some((t) => t.source === Track.Source.ScreenShare)
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 h-full w-full">
        {tracks.map((t) => (
          <ParticipantTile
            key={`${t.participant.identity}_${t.source}`}
            trackRef={t}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-2 p-2">
      {/* VÙNG HIỂN THỊ CHÍNH (Rộng nhất) */}
      <div className="flex-[3] relative bg-[#121212] rounded-lg overflow-hidden border border-slate-700/30">
        <ParticipantTile trackRef={mainTrack} className="h-full w-full" />
        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-[10px] flex items-center gap-1">
          <Maximize2 size={12} /> Tiêu điểm
        </div>
      </div>

      {/* THANH DANH SÁCH PHỤ (Bên phải hoặc dưới đáy) */}
      <div className="flex-1 min-w-[200px] max-h-[200px] md:max-h-full overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2 custom-scrollbar">
        {sidebarTracks.map((t) => (
          <div
            key={`${t.participant.identity}_${t.source}`}
            onClick={() => setFocusTrack(t)}
            className="flex-shrink-0 w-40 md:w-full aspect-video cursor-pointer hover:ring-2 ring-brand-500 rounded-lg overflow-hidden transition-all"
          >
            <ParticipantTile trackRef={t} />
          </div>
        ))}
      </div>
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
    <footer className="h-auto min-h-[80px] sm:h-20 flex-shrink-0 flex flex-wrap items-center justify-center sm:justify-between px-4 sm:px-6 bg-[#1f1f1f] border-t border-slate-800 z-30 gap-4 py-2 sm:py-0">
      <div className="hidden sm:flex items-center w-[200px]">
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

      <div className="flex items-center gap-1 sm:gap-2 w-auto sm:w-[200px] justify-end">
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
