import { useLocalParticipant } from "@livekit/components-react";
import localforage from "localforage";
import {
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Users,
  VideoIcon,
  VideoOff,
} from "lucide-react";
import { useState } from "react";

/**
 * COMPONENT: Thanh điều khiển (Toolbar)
 */
export default function CustomToolbar({
  meetingCode,
  activeTab,
  onToggleSidebar,
  hasUnreadChat,
}: {
  meetingCode: string;
  activeTab: "chat" | "people" | null;
  onToggleSidebar: (tab: "chat" | "people") => void;
  hasUnreadChat: boolean;
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

  const leaveMeeting = async () => {
    await localforage.removeItem(`meeting_chat_${meetingCode}`);
    window.close();
  };

  return (
    <footer className="h-auto min-h-20 sm:h-20 shrink-0 flex flex-wrap items-center justify-center sm:justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800/60 z-30 gap-4 py-2 sm:py-0">
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
        {/* Nút mở Sidebar (People/Chat) */}
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

        {/* Nút mở Chat với chấm đỏ nhấp nháy khi có tin nhắn chưa đọc */}
        <button
          onClick={() => onToggleSidebar("chat")}
          className={`relative p-2.5 rounded-lg transition-colors ${
            activeTab === "chat"
              ? "bg-slate-700 text-brand-400"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          <MessageSquare size={20} />

          {/* Chấm đỏ nhấp nháy khi có tin nhắn chưa đọc */}
          {hasUnreadChat && activeTab !== "chat" && (
            <span className="absolute top-1 right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-slate-900"></span>
            </span>
          )}
        </button>
      </div>
    </footer>
  );
}
