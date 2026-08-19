import { useParticipantManager } from "@/hooks/useParticipantManager";
import {
  Edit2,
  Hand,
  Loader2,
  Mic,
  MicOff,
  MoreVertical,
  UserMinus,
  VideoOff,
  Clock,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { createPortal } from "react-dom";

export default function ParticipantList({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId?: string;
  channelId?: string;
  meetingCode: string;
}) {
  const t = useTranslations("room");
  const t2 = useTranslations("meeting.participant_list");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // State quản lý Tab hiển thị
  const [activeListTab, setActiveListTab] = useState<"joined" | "waiting">(
    "joined",
  );

  const {
    localParticipant,
    displayParticipants,
    waitingParticipants,
    canManageParticipants,
    isLocalOwner,
    canApprove,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleMute,
    handleUpdateRole,
    handleTransferOwnership,
    handleRenameSubmit,
    handleApprove,
    getHandState,
  } = useParticipantManager({ roomId, channelId, meetingCode });

  return (
    <div className="flex flex-col h-full">
      {/* ================= THANH ĐIỀU HƯỚNG TABS (CHỈ DÀNH CHO ADMIN) ================= */}
      {canApprove && (
        <div className="flex p-1 bg-[#1a1a1a] rounded-lg mb-3 mx-1 border border-[#333]">
          <button
            onClick={() => setActiveListTab("joined")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-300 ${
              activeListTab === "joined"
                ? "bg-[#333] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t2("joined_members", { count: displayParticipants.length })}
          </button>

          <button
            onClick={() => setActiveListTab("waiting")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-300 ${
              activeListTab === "waiting"
                ? "bg-[#333] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t2("waiting_approval")}
            {waitingParticipants.length > 0
              ? ` (${waitingParticipants.length})`
              : ""}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1 w-full overflow-y-auto custom-scrollbar pb-64 px-1">
        {/* ================= KHU VỰC PHÒNG CHỜ ================= */}
        {canApprove && activeListTab === "waiting" && (
          <div className="animate-fade-in">
            {waitingParticipants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-60">
                <Clock
                  className="text-slate-500 mb-2"
                  size={32}
                  strokeWidth={1.5}
                />
                <p className="text-sm text-slate-400">
                  {t2("waiting_room_empty")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 w-full">
                {/* NÚT DUYỆT TẤT CẢ */}
                <div className="flex w-full justify-between px-1 pb-1">
                  <p className="text-xs text-slate-400">{t2("everyone")}</p>
                  <button
                    onClick={() => handleApprove("all", "Tất cả")}
                    className="text-xs text-amber-500 hover:text-amber-400 font-medium px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors"
                  >
                    {t2("approve_all")}
                  </button>
                </div>

                {waitingParticipants.map((p) => {
                  let avatarUrl = "";
                  try {
                    if (p.metadata) {
                      const meta = JSON.parse(p.metadata);
                      avatarUrl = meta.avatarUrl;
                    }
                  } catch (error) {}

                  return (
                    <div
                      key={p.identity}
                      className="flex items-center gap-3 p-2.5 bg-[#1a1a1a] hover:bg-[#222] rounded-lg transition-all border border-transparent hover:border-[#333]"
                    >
                      <div className="relative shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={p.name}
                            className="w-10 h-10 rounded-full object-cover opacity-70"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-sm uppercase">
                            {p.name?.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="text-sm font-medium text-slate-300 truncate">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-amber-500/80">
                          {t2("requesting_access")}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRemove(p.identity)}
                          className="p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors"
                          title={t2("reject")}
                        >
                          <UserMinus size={16} />
                        </button>
                        <button
                          onClick={() =>
                            handleApprove(p.identity, p.name || "Người dùng")
                          }
                          className="px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white text-xs font-semibold rounded-md transition-colors"
                        >
                          {t2("approve")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= KHU VỰC TRONG PHÒNG CHÍNH ================= */}
        {(!canApprove || activeListTab === "joined") && (
          <div className="animate-fade-in">
            {/* Header cho người dùng không phải Admin (Vì họ không thấy Tab) */}
            {!canApprove && (
              <div className="flex items-center justify-between mb-3 px-1 mt-1">
                <span className="text-xs font-medium text-slate-400">
                  {t2("in_session")} ({displayParticipants.length})
                </span>
              </div>
            )}

            {displayParticipants.map((p) => {
              let avatarUrl = "";
              let role = "member";
              const { isRaised } = getHandState(p);
              try {
                if (p.metadata) {
                  const meta = JSON.parse(p.metadata);
                  avatarUrl = meta.avatarUrl;
                  role = meta.role || "member";
                }
              } catch (error) {}

              const isMe = p.identity === localParticipant.identity;
              const hasMenuOptions = isMe || canManageParticipants;

              // Xác định text chức danh hiển thị dựa theo roomType
              let roleText = "";
              if (role === "owner") {
                roleText = t("role_leader", { defaultValue: "Trưởng nhóm" });
              } else if (role === "admin") {
                roleText = t("role_vice_leader", {
                  defaultValue: "Phó nhóm",
                });
              } else if (role === "guest") {
                roleText = t2("guest_user");
              }

              return (
                <div
                  key={p.identity}
                  className="flex items-center gap-3 p-2 hover:bg-[#1a1a1a] rounded-lg transition-all group border border-transparent hover:border-[#333]"
                >
                  <div className="relative shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={p.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm uppercase">
                        {p.name?.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-[1.5px] border-[#111] rounded-full"></div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {p.name}
                      {isMe && (
                        <span className="text-slate-500 font-normal ml-1.5">
                          {t2("you_label")}
                        </span>
                      )}
                    </span>

                    {role !== "member" && roleText && (
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        {roleText}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isRaised && (
                      <Hand
                        size={14}
                        className="text-amber-400 mr-1 fill-amber-400 animate-pulse"
                      />
                    )}

                    <div className="text-slate-400">
                      {p.isMicrophoneEnabled ? (
                        <div className="p-1.5 bg-slate-800/50 rounded-md">
                          <Mic size={14} className="text-emerald-400" />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-red-500/10 rounded-md">
                          <MicOff size={14} className="text-red-400" />
                        </div>
                      )}
                    </div>

                    {hasMenuOptions && (
                      <div className="relative">
                        {kickingUserId === p.identity ? (
                          <div className="p-1.5 text-red-400 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin" />
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === p.identity ? null : p.identity,
                              )
                            }
                            className="p-1.5 hover:bg-[#333] rounded-md text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>
                        )}

                        {openMenuId === p.identity && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenMenuId(null)}
                            ></div>
                            <div className="absolute right-2 top-full mt-1 z-50 w-max min-w-50 origin-top-right bg-[#222] border border-[#333] rounded py-1 shadow-2xl backdrop-blur-xl">
                              {isMe && (
                                <button
                                  onClick={() => {
                                    setRenameState({
                                      isOpen: true,
                                      newName: p.name || "",
                                    });
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white hover:bg-[#333] flex items-center gap-3 transition-colors whitespace-nowrap"
                                >
                                  <Edit2 size={15} />{" "}
                                  {t2("rename_display_name")}
                                </button>
                              )}

                              {/* MENU DÀNH CHO OWNER */}
                              {isLocalOwner && !isMe && role !== "guest" && (
                                <>
                                  {role === "admin" ? (
                                    <button
                                      onClick={() => {
                                        handleUpdateRole(p.identity, "member");
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white hover:bg-[#333] flex items-center gap-3 transition-colors whitespace-nowrap"
                                    >
                                      <UserCheck size={15} />
                                      {t("revoke_vice_leader", {
                                        defaultValue: "Thu hồi Phó nhóm",
                                      })}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        handleUpdateRole(p.identity, "admin");
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white hover:bg-[#333] flex items-center gap-3 transition-colors whitespace-nowrap"
                                    >
                                      <UserCheck size={15} />
                                      {t("appoint_vice_leader", {
                                        defaultValue: "Bổ nhiệm Phó nhóm",
                                      })}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      handleTransferOwnership(
                                        p.identity,
                                        p.name || "Thành viên",
                                      );
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white hover:bg-[#333] flex items-center gap-3 transition-colors whitespace-nowrap"
                                  >
                                    <ShieldCheck size={15} />
                                    {t("appoint_leader", {
                                      defaultValue: "Bổ nhiệm Trưởng nhóm",
                                    })}
                                  </button>
                                  <div className="h-px bg-[#444] my-1 mx-2" />
                                </>
                              )}

                              {/* CÁC THAO TÁC QUẢN LÝ CHUNG */}
                              {canManageParticipants && !isMe && (
                                <>
                                  {p.isMicrophoneEnabled && (
                                    <button
                                      onClick={() => {
                                        handleMute(
                                          p.identity,
                                          p.name || "Thành viên",
                                          "audio",
                                        );
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white hover:bg-[#333] flex items-center gap-3 transition-colors whitespace-nowrap"
                                    >
                                      <MicOff size={15} />
                                      {t2("mic_off")}
                                    </button>
                                  )}

                                  {p.isCameraEnabled && (
                                    <button
                                      onClick={() => {
                                        handleMute(
                                          p.identity,
                                          p.name || "Thành viên",
                                          "video",
                                        );
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white hover:bg-[#333] flex items-center gap-3 transition-colors whitespace-nowrap"
                                    >
                                      <VideoOff size={15} /> {t2("cam_off")}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      handleRemove(p.identity);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-3 transition-colors whitespace-nowrap"
                                  >
                                    <UserMinus size={15} />{" "}
                                    {t2("remove_from_meeting")}
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal đổi tên */}
      {renameState?.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5">
              <h3 className="text-base font-semibold text-white mb-4">
                {t2("rename_display_name")}
              </h3>

              <input
                type="text"
                value={renameState.newName}
                onChange={(e) =>
                  setRenameState({ ...renameState, newName: e.target.value })
                }
                placeholder={t("enter_new_name")}
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 mb-5 transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRenameState(null)}
                  className="px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleRenameSubmit}
                  disabled={!renameState.newName.trim()}
                  className="px-3.5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {t2("save_changes")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
