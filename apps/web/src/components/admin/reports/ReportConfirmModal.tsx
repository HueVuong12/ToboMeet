"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ReportConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "warning",
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);

  // Mount state hook for safe Next.js Server Components portal mounting
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc key down listener to dismiss popup
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open || !mounted) return null;

  const btnColors = {
    danger: "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-amber-500 hover:bg-amber-600 text-white",
    info: "bg-brand-500 hover:bg-brand-600 text-white",
  };

  const iconColors = {
    danger: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
    info: "bg-blue-100 text-blue-600",
  };

  const modalLayout = (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 overflow-hidden">
      {/* Animation injection for 200ms scale/fade transitions */}
      <style>{`
        @keyframes confirmFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes confirmScaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-confirm-backdrop {
          animation: confirmFadeIn 200ms ease-out forwards;
        }
        .animate-confirm-content {
          animation: confirmScaleUp 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Backdrop (dark overlay 50% opacity slate-900) */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-confirm-backdrop"
        onClick={onCancel}
      />

      {/* Main Dialog Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-confirm-content z-10 border border-slate-100">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconColors[variant]}`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-slate-500 mb-6">{description}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${btnColors[variant]}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalLayout, document.body);
}
