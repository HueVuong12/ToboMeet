"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useJoinRoomMutation } from "@/lib/redux/api/roomsApi";
import { X, UserPlus, Loader2, AlertCircle } from "lucide-react";

interface JoinDialogProps {
  onClose: () => void;
}

export default function JoinDialog({ onClose }: JoinDialogProps) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [joinRoom, { isLoading }] = useJoinRoomMutation();
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setError(null);

    try {
      const room = await joinRoom({ code: code.trim() }).unwrap();
      router.push(`room/${room._id}`);
    } catch (err: any) {
      setError(err?.message || t("room_not_found_code"));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleJoin();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] w-full max-w-md mx-4 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {t("join_team")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <input
            id="join-room-code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("room_code_placeholder")}
            autoFocus
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-slate-50
                       text-sm text-slate-900 placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                       transition-all"
          />

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            id="join-room-submit-btn"
            onClick={handleJoin}
            disabled={!code.trim() || isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold
                       hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("join")}
          </button>
        </div>
      </div>
    </div>
  );
}
