"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface AdminConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

export default function AdminConfirmDialog({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = "warning",
}: AdminConfirmDialogProps) {
  const t = useTranslations("admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isOpen || !isMounted) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const btnColors = {
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-red-600/10",
    warning: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10",
    info: "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/10",
  };

  const iconColors = {
    danger: "bg-red-50 text-red-600 border-red-100",
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    info: "bg-blue-50 text-blue-600 border-blue-100",
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-2 gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconColors[variant]}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{description}</p>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {cancelText || t("cancel_action") || "Hủy"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-md ${btnColors[variant]}`}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmText || t("confirm_join_action") || "Xác nhận"}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
