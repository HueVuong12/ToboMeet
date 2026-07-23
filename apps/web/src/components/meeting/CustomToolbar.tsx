import { useChatStatus } from "@/hooks/useChatStatus";
import { useHandRaise } from "@/hooks/useHandRaise";
import {
  useLocalParticipant,
  useRoomContext,
  useParticipants, // Thêm hook lấy danh sách người tham gia
} from "@livekit/components-react";
import localforage from "localforage";
import {
  Check,
  Copy,
  Hand,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreVertical,
  LogOut,
  Unlock,
  Users,
  VideoIcon,
  VideoOff,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * COMPONENT: Thanh điều khiển (Toolbar)
 * Bố cục chuẩn Zoom: Các nút vuông vức, tràn viền chiều cao, không khoảng trống.
 * Reponsive: Gom thành 1 khối căn giữa ở màn hình sm/md, chia 3 cụm ở màn hình lg.
 */
export default function CustomToolbar({
  meetingCode,
  roomId,
  channelId,
  activeTab,
  onToggleSidebar,
  hasUnreadChat,
}: {
  meetingCode: string;
  activeTab: "chat" | "people" | null;
  onToggleSidebar: (tab: "chat" | "people") => void;
  roomId: string;
  channelId: string;
  hasUnreadChat: boolean;
}) {
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const room = useRoomContext();

  // Lấy danh sách thành viên để đếm số lượng
  const participants = useParticipants();

  // State quản lý loading cho Cam/Mic
  const [isMicLoading, setIsMicLoading] = useState(false);
  const [isCamLoading, setIsCamLoading] = useState(false);

  const [isCopied, setIsCopied] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();

  // Hàm toggle Mic có trạng thái Loading
  const toggleMic = async () => {
    try {
      setIsMicLoading(true);
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      console.error("Lỗi Mic:", error);
    } finally {
      setIsMicLoading(false);
    }
  };

  // Hàm toggle Cam có trạng thái Loading
  const toggleCam = async () => {
    try {
      setIsCamLoading(true);
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (error) {
      console.error("Lỗi Camera:", error);
    } finally {
      setIsCamLoading(false);
    }
  };

  // Hook quản lý Chat
  const { isHost, isChatEnabled, handleToggleChat } = useChatStatus({
    roomId,
    channelId,
    meetingCode,
  });

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
      action: { label: "Rời đi", onClick: leaveMeeting },
      cancel: { label: "Hủy", onClick: () => {} },
      duration: 5000,
    });
  };

  const handleCopyLink = () => {
    const pathName = window.location.pathname;
    const localeRegex = /^\/[a-z]{2,3}(?=\/|$)/;
    const cleanPath = pathName.replace(localeRegex, "");
    const cleanUrl = `${window.location.origin}${cleanPath}`;

    navigator.clipboard.writeText(cleanUrl).then(() => {
      setIsCopied(true);
      toast.success("Đã sao chép liên kết!");
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Helper render style nút: Tràn chiều cao, đổi màu nền khi active, Responsive width
  const getBtnStyle = (
    isActive: boolean,
    customActiveColor = "bg-[#222] text-white",
  ) =>
    `relative flex flex-col items-center justify-center min-w-[55px] sm:min-w-[65px] h-full transition-colors ${
      isActive ? customActiveColor : "text-gray-300 hover:bg-[#222]"
    }`;

  return (
    <footer className="flex flex-row items-center justify-center lg:justify-between h-14 bg-[#111] border-t border-[#333] z-30 w-full shrink-0 select-none">
      {/* ================= PHẦN BÊN TRÁI ================= */}
      <div className="flex items-center space-x-1 mr-1 h-full lg:flex-1 justify-center lg:justify-start lg:pl-2 shrink-0">
        <button
          onClick={toggleCam}
          disabled={isCamLoading} // Khóa nút khi đang tải
          className={getBtnStyle(
            !isCameraEnabled,
            "text-red-500 hover:bg-[#222]",
          )}
        >
          {isCamLoading ? (
            <Loader2 size={20} className="animate-spin text-red-500" />
          ) : isCameraEnabled ? (
            <VideoIcon size={20} />
          ) : (
            <VideoOff size={20} />
          )}
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            Camera
          </span>
        </button>

        <button
          onClick={toggleMic}
          disabled={isMicLoading} // Khóa nút khi đang tải
          className={getBtnStyle(
            !isMicrophoneEnabled,
            "text-red-500 hover:bg-[#222]",
          )}
        >
          {isMicLoading ? (
            <Loader2 size={20} className="animate-spin text-red-500" />
          ) : isMicrophoneEnabled ? (
            <Mic size={20} />
          ) : (
            <MicOff size={20} />
          )}
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            Mic
          </span>
        </button>
      </div>

      {/* ================= PHẦN CHÍNH GIỮA ================= */}
      <div className="flex items-center space-x-1 justify-center h-full shrink-0">
        {/* Nút Thành viên (Có Badge số lượng) */}
        <button
          onClick={() => onToggleSidebar("people")}
          className={getBtnStyle(activeTab === "people")}
        >
          <div className="relative flex items-center justify-center">
            <Users
              size={20}
              className={activeTab === "people" ? "text-brand-400" : ""}
            />
            {/* Badge hiển thị số lượng thành viên */}
            <span className="absolute -top-1 -right-3.5 inline-flex items-center justify-center px-1 min-w-[16px] h-[16px] text-[9px] font-bold text-white bg-slate-600 rounded-full border-[1.5px] border-[#111]">
              {participants.length}
            </span>
          </div>
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            Thành viên
          </span>
        </button>

        {/* Nút Chat */}
        <button
          onClick={() => onToggleSidebar("chat")}
          className={getBtnStyle(activeTab === "chat")}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare
              size={20}
              className={activeTab === "chat" ? "text-brand-400" : ""}
            />
            {/* Chấm đỏ thông báo */}
            {hasUnreadChat && activeTab !== "chat" && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            Chat
          </span>
        </button>

        {/* Nút Share Screen */}
        <button
          onClick={toggleScreenShare}
          className={`hidden md:flex ${getBtnStyle(isScreenShareEnabled, "bg-green-600 text-white hover:bg-green-700")}`}
        >
          <MonitorUp
            size={20}
            className={!isScreenShareEnabled ? "text-green-500" : ""}
          />
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            Chia sẻ
          </span>
        </button>

        {/* Nút Giơ tay */}
        <button
          onClick={toggleHandRaise}
          className={getBtnStyle(isLocalHandRaised, "bg-[#222] text-amber-500")}
        >
          <Hand
            size={20}
            className={isLocalHandRaised ? "animate-bounce" : ""}
          />
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            Giơ tay
          </span>
        </button>

        {/* Nút Quản lý & Option */}
        <div className="relative h-full flex">
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={getBtnStyle(isMoreMenuOpen)}
          >
            <MoreVertical size={20} />
            <span className="text-[10px] mt-1 hidden sm:block font-medium">
              Quản lý
            </span>
          </button>

          {/* Menu Dropdown */}
          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMoreMenuOpen(false)}
              ></div>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 w-56 bg-[#222] border border-[#333] rounded shadow-2xl py-1.5 overflow-hidden backdrop-blur-xl">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#333] mb-1">
                  Tùy chọn chung
                </div>
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  {isCopied ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : (
                    <Copy size={16} />
                  )}
                  <span>
                    {isCopied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
                  </span>
                </button>

                {isHost && (
                  <>
                    <div className="px-3 py-1.5 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-[#333] bg-[#333]">
                      Công cụ Quản trị
                    </div>
                    <button
                      onClick={() => {
                        handleToggleChat();
                        setIsMoreMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                        isChatEnabled
                          ? "text-red-400 hover:bg-red-500/15"
                          : "text-emerald-400 hover:bg-emerald-500/15"
                      }`}
                    >
                      {isChatEnabled ? (
                        <>
                          <Lock size={16} /> Khóa Chat
                        </>
                      ) : (
                        <>
                          <Unlock size={16} /> Mở Chat
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= PHẦN BÊN PHẢI ================= */}
      <div className="flex items-center h-full lg:flex-1 justify-center lg:justify-end lg:pr-2 shrink-0">
        <button
          onClick={handleLeaveClick}
          className="group h-full px-3 sm:px-4 mx-1 lg:mx-0 bg-transparent text-red-500 hover:text-red-400 font-semibold hover:font-bold hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
        >
          <LogOut
            size={18}
            className="transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110"
          />
          <span className="hidden md:inline text-sm transition-all duration-300">
            Rời cuộc họp
          </span>
        </button>
      </div>
    </footer>
  );
}
