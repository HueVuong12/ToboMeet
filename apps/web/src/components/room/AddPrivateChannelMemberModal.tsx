"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/lib/redux/store";
import { useAddChannelMemberMutation, roomsApi } from "@/lib/redux/api/roomsApi";
import { useLazySearchUsersByKeywordQuery } from "@/lib/redux/api/usersApi";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channel: {
    _id?: string;
    id?: string;
    name: string;
    isPrivate?: boolean;
    members?: { userId: string; role: string }[];
  } | null;
  roomMembers: any[];
  roomOwnerId: string;
}

export default function AddPrivateChannelMemberModal({
  isOpen,
  onClose,
  roomId,
  channel,
}: Props) {
  const t = useTranslations("room");
  const dispatch = useDispatch<AppDispatch>();
  const [addChannelMember] = useAddChannelMemberMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchUsersByKeyword, { data: searchResults = [], isFetching: isSearching }] =
    useLazySearchUsersByKeywordQuery();

  const channelId = channel?._id || channel?.id || "";

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedUser(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2 && !selectedUser) {
      const delayDebounceFn = setTimeout(() => {
        searchUsersByKeyword(searchQuery.trim());
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, selectedUser, searchUsersByKeyword]);

  if (!isOpen || !channel) return null;

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedUser && !searchQuery.trim()) {
      setError(t("invite_error_empty", { defaultValue: "Vui lòng nhập email hoặc tên tài khoản" }));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const targetId = selectedUser
        ? selectedUser.supabaseId || selectedUser._id || selectedUser.id
        : undefined;
      const queryStr = selectedUser
        ? selectedUser.email || selectedUser.displayName
        : searchQuery.trim();

      const updatedRoom = await addChannelMember({
        roomId,
        channelId,
        targetUserId: targetId,
        emailOrUsername: queryStr,
      }).unwrap();

      if (updatedRoom) {
        dispatch(
          roomsApi.util.updateQueryData("getRoomById", roomId, () => updatedRoom),
        );
        dispatch(
          roomsApi.util.invalidateTags([{ type: "Room", id: roomId }, "Room"]),
        );
      }

      toast.success(t("toast_add_member_to_channel_success", { defaultValue: "Đã thêm thành viên vào kênh thành công." }));
      setSearchQuery("");
      setSelectedUser(null);
      onClose();
    } catch (err: any) {
      const rawMsg = err?.data?.message || err?.message;
      const parsedMsg = Array.isArray(rawMsg)
        ? rawMsg[0]
        : typeof rawMsg === "string"
        ? rawMsg
        : null;
      setError(parsedMsg || t("invite_error_fallback", { defaultValue: "Không thể thêm thành viên vào kênh" }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col z-10 border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-2 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">
            {t("add_member_to_channel_title", { defaultValue: "Thêm thành viên vào kênh" })}
          </h3>
          <button
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Tìm kiếm thành viên
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={
                    selectedUser
                      ? `${selectedUser.displayName} (${selectedUser.email || "Facebook"})`
                      : searchQuery
                  }
                  onChange={(e) => {
                    if (selectedUser) {
                      setSelectedUser(null);
                    }
                    setSearchQuery(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Nhập email hoặc tên tài khoản..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-8"
                />
                {(searchQuery || selectedUser) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedUser(null);
                      setError(null);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (!selectedUser && !searchQuery.trim())}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm flex-shrink-0"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Thêm</span>
              </button>
            </div>

            {/* Dropdown Gợi ý tìm kiếm */}
            {searchQuery.trim().length >= 2 && !selectedUser && (
              <div className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl py-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {isSearching ? (
                  <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
                    <span>Đang tìm kiếm...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400 font-medium">
                    Không tìm thấy người dùng
                  </div>
                ) : (
                  searchResults.map((user: any) => (
                    <button
                      key={user.supabaseId || user._id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchQuery("");
                        setError(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                          {user.displayName?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {user.email || "Tài khoản Facebook"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 animate-in fade-in duration-150">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}
