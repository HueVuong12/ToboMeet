"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Search, UserPlus, Check, RefreshCw } from "lucide-react";
import { useGlobalUserSearch } from "@/hooks/useGlobalUserSearch";
import { useInviteCalendarMembersMutation } from "@/lib/redux/api/calendarApi";
import { UserResponse } from "@tobomeet/shared/types";
import { toast } from "sonner";

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  existingMemberIds?: string[];
  existingEmails?: string[];
  onSuccess?: () => void;
}

export default function InviteMembersModal({
  isOpen,
  onClose,
  eventId,
  existingMemberIds = [],
  existingEmails = [],
  onSuccess,
}: InviteMembersModalProps) {
  const t = useTranslations("calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserResponse[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [inviteCalendarMembers, { isLoading: isInviting }] =
    useInviteCalendarMembersMutation();

  const {
    users = [],
    isSearching,
    isLoadingMore,
    hasNext,
    loadMore,
  } = useGlobalUserSearch({
    q: searchQuery,
    skip: !isOpen,
    debounceMs: 300,
  });

  // Reset state khi mở modal
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedUsers([]);
      setErrorMsg("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizedExistingIds = new Set(
    existingMemberIds.filter(Boolean).map((id) => String(id)),
  );
  const normalizedExistingEmails = new Set(
    existingEmails.filter(Boolean).map((e) => e.toLowerCase()),
  );

  const isUserAlreadyInEvent = (user: UserResponse) => {
    const sId = user.supabaseId;
    const uId = (user as any)._id || (user as any).id;
    const email = user.email?.toLowerCase();

    if (sId && normalizedExistingIds.has(String(sId))) return true;
    if (uId && normalizedExistingIds.has(String(uId))) return true;
    if (email && normalizedExistingEmails.has(email)) return true;
    return false;
  };

  const isUserSelected = (user: UserResponse) => {
    return selectedUsers.some(
      (sel) =>
        (sel.supabaseId && sel.supabaseId === user.supabaseId) ||
        ((sel as any)._id && (sel as any)._id === (user as any)._id) ||
        sel.email.toLowerCase() === user.email.toLowerCase(),
    );
  };

  const handleToggleUser = (user: UserResponse) => {
    if (isUserAlreadyInEvent(user)) return;

    if (isUserSelected(user)) {
      setSelectedUsers(
        selectedUsers.filter(
          (sel) =>
            sel.supabaseId !== user.supabaseId &&
            (sel as any)._id !== (user as any)._id &&
            sel.email.toLowerCase() !== user.email.toLowerCase(),
        ),
      );
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveSelected = (user: UserResponse) => {
    setSelectedUsers(
      selectedUsers.filter(
        (sel) =>
          sel.supabaseId !== user.supabaseId &&
          (sel as any)._id !== (user as any)._id &&
          sel.email.toLowerCase() !== user.email.toLowerCase(),
      ),
    );
  };

  const handleSendInvites = async () => {
    if (selectedUsers.length === 0 || !eventId) return;
    setErrorMsg("");

    try {
      const userIds = selectedUsers
        .map((u) => u.supabaseId || (u as any)._id)
        .filter(Boolean);

      const invitees = selectedUsers.map((u) => ({
        userId: u.supabaseId || (u as any)._id,
        email: u.email,
        displayName: u.displayName || u.email,
      }));

      await inviteCalendarMembers({
        id: eventId,
        userIds,
        invitees,
      }).unwrap();

      toast.success(t("detail_modal.invite_success"));
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Lỗi gửi lời mời:", err);
      setErrorMsg(
        err.data?.message ||
          err.message ||
          t("detail_modal.invite_error"),
      );
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              {t("detail_modal.invite_modal_title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input & Selected chips */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("detail_modal.search_users_placeholder")}
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
            {isSearching && (
              <RefreshCw className="w-4 h-4 text-brand-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
            {!isSearching && searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {selectedUsers.map((usr) => (
                <span
                  key={usr.supabaseId || (usr as any)._id || usr.email}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100 animate-in fade-in zoom-in-95"
                >
                  {usr.avatarUrl ? (
                    <img
                      src={usr.avatarUrl}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-bold flex items-center justify-center">
                      {(usr.displayName || usr.email || "?")
                        .substring(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                  <span className="max-w-[120px] truncate">
                    {usr.displayName || usr.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSelected(usr)}
                    className="hover:text-red-500 transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 min-h-[220px] max-h-[340px]">
          {isSearching && users.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
              <span>{t("create_modal.guests.searching")}</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {searchQuery.trim()
                ? t("detail_modal.no_users_found")
                : t("detail_modal.search_users_placeholder")}
            </div>
          ) : (
            <>
              {users.map((usr) => {
                const alreadyInEvent = isUserAlreadyInEvent(usr);
                const selected = isUserSelected(usr);

                return (
                  <div
                    key={usr.supabaseId || (usr as any)._id || usr.email}
                    onClick={() => {
                      if (!alreadyInEvent) handleToggleUser(usr);
                    }}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-between ${
                      alreadyInEvent
                        ? "opacity-50 cursor-not-allowed bg-slate-50/50"
                        : "cursor-pointer hover:bg-slate-50 active:scale-[0.99]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {usr.avatarUrl ? (
                        <img
                          src={usr.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                          {(usr.displayName || usr.email || "?")
                            .substring(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {usr.displayName || usr.email}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {usr.email}
                        </span>
                      </div>
                    </div>

                    <div>
                      {alreadyInEvent ? (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 font-semibold rounded-md shrink-0">
                          {t("detail_modal.already_in_event")}
                        </span>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            selected
                              ? "bg-brand-500 border-brand-500 text-white"
                              : "border-slate-300 bg-white hover:border-brand-400"
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {hasNext && (
                <div className="p-2 text-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadMore();
                    }}
                    disabled={isLoadingMore}
                    className="w-full py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isLoadingMore && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>{t("create_modal.guests.load_more")}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 hover:bg-white text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            {t("create_modal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSendInvites}
            disabled={selectedUsers.length === 0 || isInviting}
            className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isInviting && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />}
            <span>
              {selectedUsers.length > 0
                ? `${t("detail_modal.send_invites")} (${selectedUsers.length})`
                : t("detail_modal.send_invites")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
