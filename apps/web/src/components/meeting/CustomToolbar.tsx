import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import localforage from "localforage";
import {
  Check,
  Copy,
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
import { toast } from "sonner";

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
  // Trích xuất thêm isScreenShareEnabled từ useLocalParticipant
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const room = useRoomContext();

  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  // Hàm bật/tắt chia sẻ màn hình (bọc trong try-catch phòng trường hợp user ấn Hủy cấp quyền)
  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (error) {
      console.error("Lỗi khi chia sẻ màn hình:", error);
    }
  };

  const leaveMeeting = async () => {
    await localforage.removeItem(`meeting_chat_${meetingCode}`);
    room.disconnect();
  };

  const handleLeaveClick = () => {
    toast("Xác nhận rời cuộc họp?", {
      description: "Bạn sẽ bị ngắt kết nối khỏi phòng hiện tại.",
      action: {
        label: "Rời đi",
        onClick: leaveMeeting,
      },
      cancel: {
        label: "Hủy",
        onClick: () => {},
      },
      duration: 5000,
    });
  };

  // Hàm copy link
  const handleCopyLink = () => {
    const pathName = window.location.pathname;
    const localeRegex = /^\/[a-z]{2,3}(?=\/|$)/;

    // Loại bỏ locale nếu khớp với Regex
    const cleanPath = pathName.replace(localeRegex, "");

    const cleanUrl = `${window.location.origin}${cleanPath}`;

    navigator.clipboard.writeText(cleanUrl).then(() => {
      setIsCopied(true);
      toast.success("Đã sao chép liên kết!");
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <footer className="h-auto min-h-20 sm:h-20 shrink-0 flex flex-wrap items-center justify-center sm:justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800/60 z-30 gap-4 py-2 sm:py-0">
      {/* NÚT COPY LINK */}
      <div className="hidden sm:flex items-center w-50">
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/80 text-slate-300 transition-all group"
          title="Sao chép liên kết cuộc họp"
        >
          <div className="flex flex-col items-start leading-tight max-w-32.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Mã cuộc họp
            </span>
            <span className="text-xs font-mono truncate w-full text-left text-slate-200">
              {meetingCode}
            </span>
          </div>
          <div
            className={`p-1.5 rounded-lg transition-colors ${isCopied ? "bg-emerald-500/20" : "bg-slate-700 group-hover:bg-slate-600"}`}
          >
            {isCopied ? (
              <Check size={16} className="text-emerald-400" />
            ) : (
              <Copy
                size={16}
                className="text-slate-400 group-hover:text-slate-200"
              />
            )}
          </div>
        </button>
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
          onClick={handleLeaveClick}
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
