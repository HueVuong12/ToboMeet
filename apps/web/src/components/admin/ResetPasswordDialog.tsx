"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useResetPasswordMutation } from "@/lib/redux/api/adminApi";
import { Loader2, X, Lock } from "lucide-react";

interface ResetPasswordDialogProps {
  userId: string;
  userEmail: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function ResetPasswordDialog({
  userId,
  userEmail,
  onClose,
  onSuccess,
}: ResetPasswordDialogProps) {
  const t = useTranslations("admin");
  const [error, setError] = useState<string | null>(null);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await resetPassword(userId).unwrap();
      onSuccess(res.message || t("reset_password_success"));
      onClose();
    } catch (err: any) {
      if (err?.status === 403 || err?.data?.statusCode === 403) {
        setError(t("lock_error_reset"));
      } else {
        setError(err?.data?.message || err?.message || t("reset_password_error"));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            <span>{t("reset_password")}</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
            {t("reset_password_desc", { email: userEmail })}
          </div>

          {error && <p className="text-xs text-red-600 leading-normal">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {t("cancel_action")}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-brand-600/10 cursor-pointer"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("send_link")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
