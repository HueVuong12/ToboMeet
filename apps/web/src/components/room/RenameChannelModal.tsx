"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRenameChannelMutation } from "@/lib/redux/api/roomsApi";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channel: {
    _id: string;
    name: string;
    isPrivate?: boolean;
  };
}

export default function RenameChannelModal({
  isOpen,
  onClose,
  roomId,
  channel,
}: Props) {
  const t = useTranslations("room");
  const [renameChannel, { isLoading }] = useRenameChannelMutation();

  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && channel) {
      setNewName(channel.name);
      setError(null);
    }
  }, [isOpen, channel]);

  if (!isOpen || !channel) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNewName = newName.trim();

    if (!trimmedNewName) {
      setError(t("error_channel_name_empty", { defaultValue: "Tên kênh không được để trống" }));
      return;
    }

    if (trimmedNewName.length > 30) {
      setError(t("error_channel_name_too_long", { defaultValue: "Tên kênh không được vượt quá 30 ký tự" }));
      return;
    }

    // Nếu tên không thay đổi thì không gọi API
    if (trimmedNewName === channel.name) {
      onClose();
      return;
    }

    try {
      await renameChannel({
        roomId,
        channelId: channel._id,
        name: trimmedNewName,
      }).unwrap();

      toast.success(t("toast_rename_channel_success", { defaultValue: "Đổi tên kênh thành công." }));
      onClose();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || t("toast_rename_channel_error", { defaultValue: "Đổi tên kênh thất bại" }));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col z-10 max-h-[90vh] overflow-y-auto border border-slate-100">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-extrabold text-slate-900">
            {t("rename_channel_title", { defaultValue: "Đổi tên kênh" })}
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
          {/* Tên Kênh Hiện Tại */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
              {t("current_channel_name", { defaultValue: "Tên kênh hiện tại" })}
            </label>
            <div className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-base font-semibold text-slate-500 select-none">
              {channel.name}
            </div>
          </div>

          {/* Tên Kênh Mới */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              {t("new_channel_name", { defaultValue: "Tên kênh mới" })} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("new_channel_name_placeholder", { defaultValue: "Nhập tên kênh mới..." })}
              maxLength={30}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
            />
          </div>

          {error && (
            <div className="text-xs font-medium text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-100 animate-in fade-in duration-100">
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
              {t("rename_channel_cancel", { defaultValue: "Hủy" })}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-brand-600/10"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t("rename_channel_save", { defaultValue: "Lưu" })}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
