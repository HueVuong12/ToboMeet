import { useHandRaise } from "@/hooks/useHandRaise";
import { useMeetingInvite } from "@/hooks/useMeetingInvite";
import { useParticipantManager } from "@/hooks/useParticipantManager";
import { useRoomSettings } from "@/hooks/useRoomSettings";
import {
  useLocalParticipant,
  useRoomContext,
  useParticipants,
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
  ShieldAlert,
  ShieldCheck,
  UserCog,
  ChevronRight,
  UserPlus,
  CircleDot,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import InviteMemberModal from "./InviteMemberModal";
import { useTranslations } from "next-intl";
import { useIsElectron } from "@/hooks/useIsElectron";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";

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
  const t = useTranslations("meeting.toolbar");
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const room = useRoomContext();

  const participants = useParticipants();

  const [isMicLoading, setIsMicLoading] = useState(false);
  const [isCamLoading, setIsCamLoading] = useState(false);
  const [isApprovalSubmenuOpen, setIsApprovalSubmenuOpen] = useState(false);

  const [isCopied, setIsCopied] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();

  const isElectron = useIsElectron();
  const { isRecording, startRecording, stopRecording } = useScreenRecorder({
    isMicrophoneEnabled, // Chỉ thu mic khi người dùng mở
  });

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

  const {
    isHost,
    isChatEnabled,
    isWaitingRoomEnabled,
    approvalPermission,
    handleToggleChat,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
  } = useRoomSettings({
    roomId,
    channelId,
    meetingCode,
  });

  const { displayParticipants } = useParticipantManager({
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
    toast(t("confirm_leave_title"), {
      description: t("confirm_leave_description"),
      action: { label: t("confirm_leave_action"), onClick: leaveMeeting },
      cancel: { label: t("cancel"), onClick: () => {} },
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
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

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
          disabled={isCamLoading}
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
            {t("camera")}
          </span>
        </button>

        <button
          onClick={toggleMic}
          disabled={isMicLoading}
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
            {t("mic")}
          </span>
        </button>
      </div>

      {/* ================= PHẦN CHÍNH GIỮA ================= */}
      <div className="flex items-center space-x-1 justify-center h-full shrink-0">
        <button
          onClick={() => onToggleSidebar("people")}
          className={getBtnStyle(activeTab === "people")}
        >
          <div className="relative flex items-center justify-center">
            <Users
              size={20}
              className={activeTab === "people" ? "text-brand-400" : ""}
            />
            <span className="absolute -top-1 -right-3.5 inline-flex items-center justify-center px-1 min-w-4 h-4 text-[9px] font-bold text-white bg-slate-600 rounded-full border-[1.5px] border-[#111]">
              {participants.length}
            </span>
          </div>
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            {t("participants")}
          </span>
        </button>

        <button
          onClick={() => onToggleSidebar("chat")}
          className={getBtnStyle(activeTab === "chat")}
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare
              size={20}
              className={activeTab === "chat" ? "text-brand-400" : ""}
            />
            {hasUnreadChat && activeTab !== "chat" && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            {t("chat")}
          </span>
        </button>

        <button
          onClick={toggleScreenShare}
          className={`hidden md:flex ${getBtnStyle(isScreenShareEnabled, "bg-green-600 text-white hover:bg-green-700")}`}
        >
          <MonitorUp
            size={20}
            className={!isScreenShareEnabled ? "text-green-500" : ""}
          />
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            {t("share_screen")}
          </span>
        </button>

        {/* NÚT QUAY MÀN HÌNH - CHỈ HIỂN THỊ KHI CHẠY BẰNG ELECTRON */}
        {isElectron && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`hidden md:flex ${getBtnStyle(isRecording, "bg-red-600 text-white hover:bg-red-700")}`}
          >
            <CircleDot
              size={20}
              className={!isRecording ? "text-red-500" : "animate-pulse"}
            />
            <span className="text-[10px] mt-1 hidden sm:block font-medium">
              {isRecording ? "Dừng quay" : "Quay video"}
            </span>
          </button>
        )}

        <button
          onClick={toggleHandRaise}
          className={getBtnStyle(isLocalHandRaised, "bg-[#222] text-amber-500")}
        >
          <Hand
            size={20}
            className={isLocalHandRaised ? "animate-bounce" : ""}
          />
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            {t("raise_hand")}
          </span>
        </button>

        {/* Nút Tuỳ chọn và phần menu còn lại */}
        <div className="relative h-full flex">
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={getBtnStyle(isMoreMenuOpen)}
          >
            <MoreVertical size={20} />
            <span className="text-[10px] mt-1 hidden sm:block font-medium">
              {t("options")}
            </span>
          </button>

          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMoreMenuOpen(false)}
              ></div>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 w-56 bg-[#222] border border-[#333] rounded shadow-2xl py-1.5 backdrop-blur-xl">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#333] mb-1">
                  {t("general_options")}
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
                  <span>{isCopied ? t("link_copied") : t("copy_link")}</span>
                </button>

                <button
                  onClick={() => {
                    setIsInviteModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                >
                  <UserPlus size={16} />
                  <span>{t("invite_participants")}</span>
                </button>

                {isHost && (
                  <>
                    <div className="px-3 py-1.5 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-[#333] bg-[#333]">
                      {t("admin_tools")}
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleChat();
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-[#333] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageSquare
                          size={16}
                          className={
                            isChatEnabled
                              ? "text-emerald-400"
                              : "text-slate-500"
                          }
                        />
                        <span>{t("enable_chat")}</span>
                      </div>
                      <div
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isChatEnabled ? "bg-emerald-500" : "bg-slate-600"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isChatEnabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWaitingRoom();
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-[#333] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck
                          size={16}
                          className={
                            isWaitingRoomEnabled
                              ? "text-amber-400"
                              : "text-slate-500"
                          }
                        />
                        <span>{t("waiting_room")}</span>
                      </div>
                      <div
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isWaitingRoomEnabled
                            ? "bg-emerald-500"
                            : "bg-slate-600"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isWaitingRoomEnabled
                              ? "translate-x-4"
                              : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>

                    {isWaitingRoomEnabled && (
                      <div
                        className="relative"
                        onMouseEnter={() => setIsApprovalSubmenuOpen(true)}
                        onMouseLeave={() => setIsApprovalSubmenuOpen(false)}
                      >
                        <div className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-[#333] flex items-center justify-between transition-colors cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <UserCog size={16} className="text-slate-500" />
                            <span>{t("approval_permission")}</span>
                          </div>
                          <ChevronRight size={16} className="text-slate-500" />
                        </div>

                        {isApprovalSubmenuOpen && (
                          <div className="absolute left-full bottom-0 ml-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-2xl py-1.5 overflow-hidden backdrop-blur-xl">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateApprovalPermission("admin_only");
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-[#333] flex items-center gap-2.5 transition-colors"
                            >
                              <Check
                                size={14}
                                className={
                                  approvalPermission === "admin_only"
                                    ? "opacity-100 text-emerald-400"
                                    : "opacity-0"
                                }
                              />
                              <span>{t("admin_only")}</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateApprovalPermission(
                                  "member_and_admin",
                                );
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-[#333] flex items-center gap-2.5 transition-colors"
                            >
                              <Check
                                size={14}
                                className={
                                  approvalPermission === "member_and_admin"
                                    ? "opacity-100 text-emerald-400"
                                    : "opacity-0"
                                }
                              />
                              <span>{t("member_and_admin")}</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateApprovalPermission("everyone");
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-[#333] flex items-center gap-2.5 transition-colors"
                            >
                              <Check
                                size={14}
                                className={
                                  approvalPermission === "everyone"
                                    ? "opacity-100 text-emerald-400"
                                    : "opacity-0"
                                }
                              />
                              <span>{t("everyone")}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
            {t("leave_meeting")}
          </span>
        </button>
      </div>

      {/* ================= MODAL MỜI THÀNH VIÊN ================= */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId}
        meetingCode={meetingCode}
        displayParticipants={displayParticipants}
      />
    </footer>
  );
}
