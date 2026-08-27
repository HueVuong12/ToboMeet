import { Loader2, Search, UserMinus, UserPlus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useMeetingInvite } from "@/hooks/useMeetingInvite";
import { Participant } from "livekit-client";
import { useTranslations } from "next-intl";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
  displayParticipants: Participant[];
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  meetingCode,
  displayParticipants,
}: InviteMemberModalProps) {
  const t = useTranslations("meeting.invite_member_modal");
  const {
    searchQuery,
    setSearchQuery,
    isLoading,
    isFetching,
    hasNextPage,
    availableMembersToInvite,
    invitingUserId,
    handleSendInvite,
    loadMore,
  } = useMeetingInvite({
    meetingCode,
    displayParticipants,
    isOpen,
  });

  if (!isOpen) return null;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (hasNextPage && !isFetching) {
        loadMore();
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 px-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-[#1c1c1c] border border-[#333] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#333]">
          <h3 className="text-[15px] font-bold text-white tracking-wide flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" />
            {t("title")}
          </h3>
          <button
            onClick={onClose}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              className="w-full pl-9 pr-4 py-2.5 bg-[#222] border border-[#333] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
              autoFocus
            />
          </div>
        </div>

        {/* Danh sách thành viên */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar p-3 relative"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-xs text-slate-400">{t("searching")}</span>
            </div>
          ) : availableMembersToInvite &&
            availableMembersToInvite.length > 0 ? (
            <div className="flex flex-col gap-1">
              {availableMembersToInvite.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-2.5 hover:bg-[#2a2a2a] rounded-xl transition-all border border-transparent hover:border-[#333]"
                >
                  <div className="relative shrink-0">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-[#333] bg-[#222]"
                        onError={(e) => {
                          const fallbackName = member.displayName || "?";
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            fallbackName,
                          )}&background=1e293b&color=94a3b8&bold=true`;
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-sm uppercase border border-[#333]">
                        {member.displayName?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-sm font-medium text-slate-200 truncate flex items-center gap-1.5">
                      {member.displayName || "Người dùng"}
                      {/* {member.isOutsider && (
                        <span className="px-1.5 py-0.5 bg-brand-500/20 text-brand-400 text-[9px] font-bold rounded-md tracking-wide uppercase border border-brand-500/30">
                          {t("outsider_badge")}
                        </span>
                      )} */}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate mt-0.5">
                      {member.email}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      handleSendInvite(
                        member.userId,
                        member.displayName || t("default_user_name"),
                      )
                    }
                    disabled={invitingUserId === member.userId}
                    className="shrink-0 px-4 py-1.5 bg-[#222] border border-[#333] hover:border-brand-500 hover:bg-brand-600/10 text-slate-300 hover:text-brand-400 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-17.5"
                  >
                    {invitingUserId === member.userId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      t("invite_button")
                    )}
                  </button>
                </div>
              ))}
              {isFetching && !isLoading && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 opacity-60">
              <UserMinus
                className="text-slate-600 mb-3"
                size={36}
                strokeWidth={1.5}
              />
              <p className="text-sm text-slate-400 text-center px-4">
                {searchQuery
                  ? t("no_search_results")
                  : t("all_members_present")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
