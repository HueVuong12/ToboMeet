import { useHandRaise } from "@/hooks/useHandRaise";
import { useParticipantManager } from "@/hooks/useParticipantManager";
import { useRoomSettings } from "@/hooks/useRoomSettings";
import {
  Check,
  Copy,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreVertical,
  LogOut,
  Users,
  VideoIcon,
  VideoOff,
  Loader2,
  ShieldCheck,
  UserCog,
  ChevronRight,
  UserPlus,
  Play,
  Pause,
  Square,
  Network,
  Cloud,
  Laptop,
  Info,
  Disc,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import InviteMemberModal from "./InviteMemberModal";
import { useTranslations } from "next-intl";
import { useIsElectron } from "@/hooks/useIsElectron";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { useCloudRecorder } from "@/hooks/useCloudRecorder";
import { useToolbarActions } from "@/hooks/useToolbarActions";
import CreateBreakoutModal from "./CreateBreakoutModal";
import JoinBreakoutModal from "./JoinBreakoutModal";

/**
 * COMPONENT: Thanh điều khiển (Toolbar)
 * Bố cục chuẩn Zoom: Các nút vuông vức, tràn viền chiều cao, không khoảng trống.
 * Reponsive: Gom thành 1 khối căn giữa ở màn hình sm/md, chia 3 cụm ở màn hình lg.
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
  const t = useTranslations("meeting.toolbar");

  const [isApprovalSubmenuOpen, setIsApprovalSubmenuOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBreakoutModalOpen, setIsBreakoutModalOpen] = useState(false);
  const [isJoinBreakoutModalOpen, setIsJoinBreakoutModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRecordMenuOpen, setIsRecordMenuOpen] = useState(false);
  const [isLeaveMenuOpen, setIsLeaveMenuOpen] = useState(false);

  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();
  const isElectron = useIsElectron();

  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    isSomeoneElseSharing,
    isMicLoading,
    isCamLoading,
    isScreenShareLoading,
    isCopied,
    isLeavingBreakout,

    // Actions
    toggleMic,
    toggleCam,
    toggleScreenShare,
    handleLeaveClick,
    handleCopyLink,
    handleLeaveBreakout,
  } = useToolbarActions();

  // Cloud Recorder (LiveKit Egress)
  const {
    isRecording: isCloudRecording,
    isLoading: isCloudRecordingLoading,
    startRecording: startCloudRecording,
    stopRecording: stopCloudRecording,
  } = useCloudRecorder({
    meetingCode,
  });

  // Local Recorder (Electron MediaRecorder)
  const {
    isRecording: isLocalRecording,
    isPaused: isLocalPaused,

    // Actions
    pauseRecording: pauseLocalRecording,
    resumeRecording: resumeLocalRecording,
    startRecording: startLocalRecording,
    stopRecording: stopLocalRecording,
  } = useScreenRecorder({
    isMicrophoneEnabled, // Chỉ thu mic khi người dùng mở
  });

  const {
    isHost,
    isChatEnabled,
    isWaitingRoomEnabled,
    isBreakoutActive,
    approvalPermission,
    breakoutRoomsList,
    roomType,
    isEndingBreakout,

    // Actions
    handleToggleChat,
    handleEndBreakout,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
  } = useRoomSettings({
    meetingCode,
  });

  // Xác nhận trước khi quay màn hình bằng toast
  const handleConfirmStartCloudRecording = () => {
    setIsRecordMenuOpen(false);
    toast(t("confirm_record_cloud_title"), {
      description: t("confirm_record_cloud_desc"),
      action: {
        label: t("confirm_record_action"),
        onClick: () => {
          startCloudRecording();
        },
      },
      cancel: {
        label: t("cancel"),
        onClick: () => {},
      },
      duration: 8000,
    });
  };

  const handleConfirmStartLocalRecording = () => {
    if (!isElectron) return;
    setIsRecordMenuOpen(false);
    toast(t("confirm_record_local_title"), {
      description: t("confirm_record_local_desc"),
      action: {
        label: t("confirm_record_action"),
        onClick: () => {
          startLocalRecording();
        },
      },
      cancel: {
        label: t("cancel"),
        onClick: () => {},
      },
      duration: 8000,
    });
  };

  const isInBreakoutRoom = roomType === "breakout";

  const { displayParticipants } = useParticipantManager({
    meetingCode,
  });

  const getBtnStyle = (
    isActive: boolean,
    customActiveColor = "bg-[#222] text-white",
  ) =>
    `relative flex flex-col items-center justify-center min-w-[55px] sm:min-w-[65px] h-full transition-colors ${isActive ? customActiveColor : "text-gray-300 hover:bg-[#222]"
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
            <span className="absolute -top-1 -right-2.5 text-[10px] font-semibold text-slate-300">
              {displayParticipants.length}
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
          disabled={isSomeoneElseSharing || isScreenShareLoading}
          className={`hidden md:flex ${getBtnStyle(
            isScreenShareEnabled,
            "bg-green-600 text-white hover:bg-green-700",
          )} ${isSomeoneElseSharing || isScreenShareLoading ? "opacity-40 cursor-not-allowed hover:bg-[#222]" : ""}`}
        >
          {isScreenShareLoading ? (
            <Loader2 size={20} className="animate-spin text-green-500" />
          ) : (
            <MonitorUp
              size={20}
              className={
                !isScreenShareEnabled && !isSomeoneElseSharing
                  ? "text-green-500"
                  : ""
              }
            />
          )}
          <span className="text-[10px] mt-1 hidden sm:block font-medium">
            {t("share_screen")}
          </span>
        </button>

        {/* ================= NÚT GHI HÌNH VỚI TOOLTIP / POPOVER MENU ================= */}
        <div className="relative h-full hidden md:flex">
          <button
            onClick={() => setIsRecordMenuOpen(!isRecordMenuOpen)}
            disabled={isCloudRecordingLoading}
            className={getBtnStyle(
              isRecordMenuOpen || isCloudRecording || isLocalRecording,
              isCloudRecording
                ? "bg-[#222] text-red-500 hover:bg-[#222]"
                : isLocalRecording
                ? "bg-[#222] text-amber-500 hover:bg-[#222]"
                : "bg-[#222] text-white",
            )}
            title={t("record")}
          >
            <div className="relative flex items-center justify-center">
              {isCloudRecordingLoading ? (
                <Loader2 size={20} className="animate-spin text-red-500" />
              ) : isCloudRecording ? (
                <div className="relative flex items-center justify-center">
                  <Disc size={20} className="text-red-500 animate-spin" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                </div>
              ) : isLocalRecording ? (
                <div className="relative flex items-center justify-center">
                  <Disc size={20} className="text-amber-500 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                </div>
              ) : (
                <Disc size={20} className="text-slate-300" />
              )}
              <ChevronUp
                size={11}
                className={`absolute -top-1.5 -right-3 text-slate-400 transition-transform duration-200 ${
                  isRecordMenuOpen ? "rotate-180 text-white" : ""
                }`}
              />
            </div>
            <span
              className={`text-[10px] mt-1 hidden sm:block font-medium ${
                isCloudRecording
                  ? "text-red-500 font-semibold"
                  : isLocalRecording
                  ? "text-amber-500 font-semibold"
                  : ""
              }`}
            >
              {t("record")}
            </span>
          </button>

          {/* MENU TOOLTIP / POPOVER TÙY CHỌN GHI HÌNH */}
          {isRecordMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsRecordMenuOpen(false)}
              ></div>
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 w-72 bg-[#222] border border-[#333] rounded-lg shadow-2xl py-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#333] mb-1 flex items-center justify-between">
                  <span>{t("record_options")}</span>
                  {(isCloudRecording || isLocalRecording) && (
                    <span className="flex items-center gap-1 text-[9px] text-red-400 font-semibold lowercase bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      {t("recording_in_progress")}
                    </span>
                  )}
                </div>

                {/* OPTION 1: GHI HÌNH TRÊN ĐÁM MÂY (CLOUD RECORDING) */}
                <div className="px-1.5 py-1">
                  {!isCloudRecording ? (
                    <button
                      type="button"
                      disabled={isCloudRecordingLoading}
                      onClick={handleConfirmStartCloudRecording}
                      className="w-full text-left p-2 rounded-md hover:bg-[#333] flex items-start gap-2.5 transition-colors group cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 transition-colors shrink-0 mt-0.5">
                        {isCloudRecordingLoading ? (
                          <Loader2 size={16} className="animate-spin text-red-500" />
                        ) : (
                          <Cloud size={16} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-white flex items-center justify-between">
                          <span>{t("record_cloud")}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                            Cloud
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {t("record_cloud_desc")}
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="p-2 rounded-md bg-red-950/20 border border-red-900/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex items-center justify-center shrink-0">
                          <Cloud size={16} className="text-red-400 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-red-400 truncate">
                            {t("record_cloud")}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t("recording_in_progress")}...
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isCloudRecordingLoading}
                        onClick={() => {
                          setIsRecordMenuOpen(false);
                          stopCloudRecording();
                        }}
                        className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors flex items-center gap-1 shrink-0"
                      >
                        {isCloudRecordingLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Square size={11} fill="currentColor" />
                        )}
                        <span>{t("stop_recording")}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* OPTION 2: GHI HÌNH CỤC BỘ (LOCAL RECORDING) */}
                <div className="px-1.5 pb-1">
                  {!isElectron ? (
                    <div
                      className="w-full text-left p-2 rounded-md bg-[#181818] border border-[#282828] opacity-40 cursor-not-allowed flex items-start gap-2.5 select-none"
                      title={t("electron_only_badge")}
                    >
                      <div className="p-2 rounded-lg bg-slate-800 text-slate-500 shrink-0 mt-0.5">
                        <Laptop size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                          <span>{t("record_local")}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700">
                            Local
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {t("record_local_desc")}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500/80 font-medium">
                          <Info size={11} />
                          <span>{t("electron_only_badge")}</span>
                        </div>
                      </div>
                    </div>
                  ) : !isLocalRecording ? (
                    <button
                      type="button"
                      onClick={handleConfirmStartLocalRecording}
                      className="w-full text-left p-2 rounded-md hover:bg-[#333] flex items-start gap-2.5 transition-colors group cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors shrink-0 mt-0.5">
                        <Laptop size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-white flex items-center justify-between">
                          <span>{t("record_local")}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                            Desktop
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {t("record_local_desc")}
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="p-2 rounded-md bg-amber-950/20 border border-amber-900/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex items-center justify-center shrink-0">
                          <Laptop size={16} className="text-amber-400 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-amber-400 truncate">
                            {t("record_local")}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isLocalPaused ? t("pause") : `${t("recording_in_progress")}...`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={isLocalPaused ? resumeLocalRecording : pauseLocalRecording}
                          className="p-1.5 text-xs text-amber-400 hover:bg-white/10 rounded transition-colors"
                          title={isLocalPaused ? t("resume") : t("pause")}
                        >
                          {isLocalPaused ? (
                            <Play size={13} fill="currentColor" />
                          ) : (
                            <Pause size={13} fill="currentColor" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRecordMenuOpen(false);
                            stopLocalRecording();
                          }}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors flex items-center gap-1"
                          title={t("stop_recording")}
                        >
                          <Square size={11} fill="currentColor" />
                          <span>{t("stop_recording")}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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

        {/* NÚT BREAKOUT: CHỈ HIỂN THỊ KHI ĐANG CÓ PHIÊN HOẠT ĐỘNG */}
        {isBreakoutActive && (
          <button
            onClick={() => setIsJoinBreakoutModalOpen(true)}
            className={getBtnStyle(false, "bg-[#222] text-white")}
          >
            <Network
              size={20}
              className="text-blue-400 animate-pulse drop-shadow-md"
            />
            <span className="text-[10px] mt-1 hidden sm:block font-medium text-blue-400">
              {t("breakout")}
            </span>
          </button>
        )}

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

                    {/* MENU CHIA NHÓM THẢO LUẬN TỰ ĐỘNG CHUYỂN ĐỔI */}
                    {!isBreakoutActive ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBreakoutModalOpen(true);
                          setIsMoreMenuOpen(false); // Ẩn dropdown đi
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-[#333] flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Network size={16} className="text-blue-400" />
                          <span>{t("create_breakout")}</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isEndingBreakout}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleEndBreakout();
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2.5 font-medium">
                          {isEndingBreakout ? (
                            <Loader2 size={16} className="animate-spin text-red-400" />
                          ) : (
                            <Square
                              size={16}
                              className="text-red-500"
                              fill="currentColor"
                            />
                          )}
                          <span>{t("end_breakout")}</span>
                        </div>
                      </button>
                    )}

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
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isChatEnabled ? "bg-emerald-500" : "bg-slate-600"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isChatEnabled ? "translate-x-4" : "translate-x-0"
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
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isWaitingRoomEnabled
                          ? "bg-emerald-500"
                          : "bg-slate-600"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isWaitingRoomEnabled
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

      {/* ================= PHẦN BÊN PHẢI (GỘP NÚT RỜI PHÒNG) ================= */}
      <div className="relative flex items-center h-full lg:flex-1 justify-center lg:justify-end lg:pr-2 shrink-0">
        <button
          onClick={() => {
            if (isInBreakoutRoom) {
              // Bật/tắt menu tooltip khi đang ở trong breakout room
              setIsLeaveMenuOpen(!isLeaveMenuOpen);
            } else {
              // Nếu ở phòng họp chính, chạy thẳng hàm thoát
              handleLeaveClick();
            }
          }}
          disabled={isLeavingBreakout}
          className="group h-full px-3 sm:px-4 mx-1 lg:mx-0 bg-transparent text-red-500 hover:text-red-400 font-semibold hover:font-bold hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
        >
          {isLeavingBreakout ? (
            <Loader2 size={18} className="animate-spin text-red-500" />
          ) : (
            <LogOut
              size={18}
              className="transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110"
            />
          )}
          <span className="hidden md:inline text-sm transition-all duration-300">
            {isInBreakoutRoom ? t("leave_short") : t("leave_meeting")}
          </span>
        </button>

        {/* TOOLTIP MENU KHI Ở PHÒNG BREAKOUT */}
        {isLeaveMenuOpen && isInBreakoutRoom && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsLeaveMenuOpen(false)}
            ></div>
            <div className="absolute bottom-full right-2 lg:right-4 mb-2 z-50 w-52 bg-[#222] border border-[#333] rounded-lg shadow-2xl py-1.5 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => {
                  setIsLeaveMenuOpen(false);
                  handleLeaveBreakout();
                }}
                disabled={isLeavingBreakout}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#333] flex items-center gap-2.5 transition-colors disabled:opacity-50"
              >
                <LogOut size={16} className="-scale-x-100" />
                <span>{t("leave_breakout_room")}</span>
              </button>

              <button
                onClick={() => {
                  setIsLeaveMenuOpen(false);
                  handleLeaveClick();
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-[#333] flex items-center gap-2.5 transition-colors"
              >
                <LogOut size={16} />
                <span>{t("leave_meeting")}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ================= MODAL MỜI THÀNH VIÊN ================= */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        meetingCode={meetingCode}
        displayParticipants={displayParticipants}
      />

      {/* ================= MODAL TẠO BREAKOUT ================= */}
      <CreateBreakoutModal
        isOpen={isBreakoutModalOpen}
        onClose={() => setIsBreakoutModalOpen(false)}
        meetingCode={meetingCode}
      />

      {/* ================= MODAL JOIN BREAKOUT ================= */}
      <JoinBreakoutModal
        meetingCode={meetingCode}
        isOpen={isJoinBreakoutModalOpen}
        onClose={() => setIsJoinBreakoutModalOpen(false)}
        rooms={breakoutRoomsList}
      />
    </footer>
  );
}
