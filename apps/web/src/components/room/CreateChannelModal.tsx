"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Lock, Globe, Loader2, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAddChannelMutation } from "@/lib/redux/api/roomsApi";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomMembers: any[];
  currentUserId: string;
}

export default function CreateChannelModal({
  isOpen,
  onClose,
  roomId,
  roomMembers,
  currentUserId,
}: Props) {
  const t = useTranslations("room");
  const [addChannel, { isLoading }] = useAddChannelMutation();

  const [channelName, setChannelName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setChannelName("");
      setIsPrivate(false);
      setSelectedMemberIds([]);
      setMemberSearchQuery("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!channelName.trim()) {
      setError(t("error_channel_name_required", { defaultValue: "Vui lòng nhập tên kênh" }));
      return;
    }

    try {
      await addChannel({
        roomId,
        name: channelName.trim(),
        isPrivate,
        initialMemberIds: isPrivate ? selectedMemberIds : [],
      }).unwrap();

      toast.success(t("channel_created_success", { defaultValue: "Tạo kênh thành công" }));
      onClose();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || "Tạo kênh thất bại");
    }
  };

  const eligibleMembers = roomMembers.filter((m) => m.userId !== currentUserId);

  const filteredMembers = eligibleMembers.filter((m) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.trim().toLowerCase();
    const nameMatch = m.displayName?.toLowerCase().includes(q);
    const emailMatch = m.email?.toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl p-8 flex flex-col z-10 max-h-[90vh] overflow-y-auto border border-slate-100">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            {t("create_channel_title", { defaultValue: "Tạo kênh mới" })}
          </h3>
          <button
            disabled={isLoading}
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tên Kênh */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              {t("channel_name_label", { defaultValue: "Tên kênh" })} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder={t("channel_name_placeholder", { defaultValue: "Ví dụ: NodeJS, ReactJS, Bài tập..." })}
              maxLength={30}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
            />
          </div>

          {/* Quyền riêng tư của Kênh */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              {t("channel_privacy_label", { defaultValue: "Quyền riêng tư của kênh" })}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label
                className={`flex flex-col p-4 rounded-2xl border cursor-pointer transition-all ${
                  !isPrivate
                    ? "border-brand-500 bg-brand-50/50 text-brand-900 ring-2 ring-brand-500/20 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="isPrivate"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="w-4 h-4 text-brand-600 focus:ring-brand-500"
                  />
                  <Globe className="w-5 h-5 text-brand-600 flex-shrink-0" />
                  <span className="text-base font-bold">{t("channel_public", { defaultValue: "Công khai" })}</span>
                </div>
                <span className="text-xs text-slate-500 pl-6 leading-normal">
                  {t("channel_public_desc", { defaultValue: "Tất cả thành viên trong phòng đều có quyền xem" })}
                </span>
              </label>

              <label
                className={`flex flex-col p-4 rounded-2xl border cursor-pointer transition-all ${
                  isPrivate
                    ? "border-amber-500 bg-amber-50/50 text-amber-900 ring-2 ring-amber-500/20 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <input
                    type="radio"
                    name="isPrivate"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span className="text-base font-bold">{t("channel_private", { defaultValue: "Riêng tư" })}</span>
                </div>
                <span className="text-xs text-slate-500 pl-6 leading-normal">
                  {t("channel_private_desc", { defaultValue: "Chỉ các thành viên được chỉ định mới truy cập được" })}
                </span>
              </label>
            </div>
          </div>

          {/* Chọn thành viên cho Kênh Riêng tư */}
          {isPrivate && (
            <div className="space-y-3">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {t("channel_select_members", { defaultValue: "Thành viên được cấp quyền truy cập" })} ({selectedMemberIds.length})
              </label>

              {/* Danh sách thẻ Chips đã chọn */}
              {selectedMemberIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-amber-50/60 rounded-xl border border-amber-200/70 max-h-28 overflow-y-auto">
                  {selectedMemberIds.map((id) => {
                    const member = eligibleMembers.find((m) => m.userId === id);
                    const name = member?.displayName || member?.email || id;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-amber-900 border border-amber-200 shadow-2xs"
                      >
                        {member?.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={name}
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[9px] flex-shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate max-w-[160px]">{name}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleMember(id)}
                          className="text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Ô nhập tìm kiếm thành viên trong phòng */}
              <div className="relative">
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder={t("search_member_placeholder", { defaultValue: "Nhập email hoặc tên tài khoản..." })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all pr-8"
                />
                {memberSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMemberSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Danh sách thành viên thỏa điều kiện lọc */}
              {eligibleMembers.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-150">
                  {t("no_other_members", { defaultValue: "Chưa có thành viên nào khác trong phòng" })}
                </p>
              ) : filteredMembers.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-150">
                  {t("no_member_found", { defaultValue: "Không tìm thấy thành viên phù hợp" })}
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50/80 rounded-2xl border border-slate-200">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.userId);
                    return (
                      <div
                        key={m.userId}
                        onClick={() => handleToggleMember(m.userId)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected ? "bg-amber-100/70 text-amber-900 font-bold shadow-2xs" : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.displayName || "Avatar"}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {(m.displayName || m.email || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {m.displayName || "Thành viên"}
                            </span>
                            {m.email && (
                              <span className="text-[11px] font-normal text-slate-400 truncate">
                                {m.email}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 flex-shrink-0 ml-2" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs font-medium text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              {t("cancel_action", { defaultValue: "Hủy" })}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-brand-600/10"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t("create_channel_action", { defaultValue: "Tạo kênh" })}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
