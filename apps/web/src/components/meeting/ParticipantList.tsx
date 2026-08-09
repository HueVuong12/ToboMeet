import { useParticipantManager } from "@/hooks/useParticipantManager";
import { useSendMeetingInviteMutation } from "@/lib/redux/api/meetingsApi";
import { useGetRoomMembersQuery } from "@/lib/redux/api/roomsApi";
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
  UserPlus,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export default function ParticipantList({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string | null;
  channelId: string | null;
  meetingCode: string;
}) {
  const t = useTranslations("room");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");

  // Lấy danh sách thành viên của phòng (Chỉ gọi khi roomId tồn tại)
  const { data: roomMembers, isLoading: isMembersLoading } =
    useGetRoomMembersQuery(roomId || "", {
      skip: !roomId || !isInviteModalOpen,
    });

  const [sendInvite, { isLoading: isInviting }] =
    useSendMeetingInviteMutation();

  // State quản lý Tab hiển thị
  const [activeListTab, setActiveListTab] = useState<"joined" | "waiting">(
    "joined",
  );

  const handleSendInvite = async (userId: string, displayName: string) => {
    setInvitingUserId(userId);
    try {
      await sendInvite({ meetingCode, inviteeId: userId }).unwrap();
      toast.success(`Đã gửi lời mời đến ${displayName}`);
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          error?.message ||
          "Không thể gửi lời mời lúc này.",
      );
    } finally {
      setInvitingUserId(null);
    }
  };

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

  const availableMembersToInvite = roomMembers?.filter((member) => {
    // Không mời người đã có trong phòng
    const isAlreadyInRoom = displayParticipants.some(
      (p) => p.identity === member.userId,
    );
    if (isAlreadyInRoom) return false;

    // Không mời những người đã bị remove khỏi Room
    if (member.status === "removed") return false;

    // Lọc theo text tìm kiếm
    if (searchMemberQuery) {
      const q = searchMemberQuery.toLowerCase();
      return (
        member.displayName?.toLowerCase().includes(q) ||
        member.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <span className="text-[13px] font-bold text-slate-200 tracking-wide">
          Thành viên
        </span>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 hover:text-white text-blue-500 rounded-lg text-xs font-semibold transition-all duration-200"
        >
          <UserPlus size={14} />
          <span>Mời người</span>
        </button>
      </div> */}

      {/* ================= MODAL MỜI THÀNH VIÊN (PORTAL) ================= */}
      {isInviteModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-[#1c1c1c] border border-[#333] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#333]">
                <h3 className="text-[15px] font-bold text-white tracking-wide flex items-center gap-2">
                  <UserPlus size={18} className="text-blue-500" />
                  Mời vào cuộc họp
                </h3>
                <button
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setSearchMemberQuery("");
                  }}
                  className="p-1.5 hover:bg-[#333] rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="px-5 py-4 bg-[#111]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc email..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[#222] border border-[#333] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Danh sách thành viên để mời */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {isMembersLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="text-xs text-slate-400">
                      Đang tải danh sách...
                    </span>
                  </div>
                ) : availableMembersToInvite &&
                  availableMembersToInvite.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {availableMembersToInvite.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 p-2.5 hover:bg-[#2a2a2a] rounded-xl transition-all border border-transparent hover:border-[#333]"
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.displayName}
                              className="w-10 h-10 rounded-full object-cover border border-[#333]"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-sm uppercase border border-[#333]">
                              {member.displayName?.charAt(0) || "?"}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <span className="text-sm font-medium text-slate-200 truncate">
                            {member.displayName || "Người dùng"}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate mt-0.5">
                            {member.email}
                          </span>
                        </div>

                        {/* Nút Mời */}
                        <button
                          onClick={() =>
                            handleSendInvite(
                              member.userId,
                              member.displayName || "Người dùng",
                            )
                          }
                          disabled={invitingUserId === member.userId}
                          className="shrink-0 px-4 py-1.5 bg-[#222] border border-[#333] hover:border-blue-500 hover:bg-blue-600/10 text-slate-300 hover:text-blue-400 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
                        >
                          {invitingUserId === member.userId ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            "Mời"
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-60">
                    <UserMinus
                      className="text-slate-600 mb-3"
                      size={36}
                      strokeWidth={1.5}
                    />
                    <p className="text-sm text-slate-400 text-center px-4">
                      {searchMemberQuery
                        ? "Không tìm thấy thành viên nào phù hợp."
                        : "Tất cả thành viên đã có mặt trong phòng."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

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
            Đã tham gia ({displayParticipants.length})
          </button>

          <button
            onClick={() => setActiveListTab("waiting")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-300 ${
              activeListTab === "waiting"
                ? "bg-[#333] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Chờ duyệt
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
                  Không có ai ở phòng chờ
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 w-full">
                {/* NÚT DUYỆT TẤT CẢ */}
                <div className="flex w-full justify-between px-1 pb-1">
                  <p className="text-xs text-slate-400">Mọi người</p>
                  <button
                    onClick={() => handleApprove("all", "Tất cả")}
                    className="text-xs text-amber-500 hover:text-amber-400 font-medium px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors"
                  >
                    Duyệt tất cả
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
                          Đang yêu cầu tham gia...
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRemove(p.identity)}
                          className="p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors"
                          title="Từ chối"
                        >
                          <UserMinus size={16} />
                        </button>
                        <button
                          onClick={() =>
                            handleApprove(p.identity, p.name || "Người dùng")
                          }
                          className="px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white text-xs font-semibold rounded-md transition-colors"
                        >
                          Duyệt
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
                  Đang tham gia
                </span>
                {/* Đã sửa: Làm mỏng lại, bo góc nhẹ (rounded-md), thêm viền tinh tế */}
                <span className="text-[11px] font-medium bg-[#222] border border-[#333] text-slate-400 px-2 py-0.5 rounded-md shadow-sm">
                  {displayParticipants.length} người
                </span>
              </div>
            )}

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 mx-1 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-medium transition-all duration-200"
              style={{ width: "calc(100% - 8px)" }} // Trừ hao lề mx-1
            >
              <UserPlus size={15} />
              <span>Mời người khác</span>
            </button>

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
                roleText = "Người ngoài";
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
                          (Bạn)
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
                                  <Edit2 size={15} /> Đổi tên
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
                                      <MicOff size={15} /> Tắt Mic
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
                                      <VideoOff size={15} /> Tắt Camera
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      handleRemove(p.identity);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-3 transition-colors whitespace-nowrap"
                                  >
                                    <UserMinus size={15} /> Xoá khỏi phòng
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

      {/* Render Modal Đổi Tên bằng Portal */}
      {renameState?.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-[#222] border border-[#333] rounded-xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-lg font-semibold text-white mb-4 tracking-wide">
                Đổi tên hiển thị
              </h3>

              <input
                type="text"
                value={renameState.newName}
                onChange={(e) =>
                  setRenameState({ ...renameState, newName: e.target.value })
                }
                placeholder="Nhập tên mới..."
                className="w-full px-4 py-3 bg-[#111] border border-[#444] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-6 transition-colors"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRenameState(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-[#333] rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRenameSubmit}
                  disabled={!renameState.newName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
