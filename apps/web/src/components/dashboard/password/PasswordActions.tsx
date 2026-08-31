"use client";

import { Loader2 } from "lucide-react";

interface PasswordActionsProps {
  isLoading?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
}

export function PasswordActions({
  isLoading = false,
  disabled = false,
  onCancel,
  submitLabel,
  submittingLabel,
  cancelLabel,
}: PasswordActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      {/* Nut Huy */}
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="px-4 py-2 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {cancelLabel}
      </button>

      {/* Nut Doi mat khau */}
      <button
        type="submit"
        disabled={disabled || isLoading}
        className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold text-white bg-linear-to-r from-brand-500 to-indigo-600 shadow-md shadow-brand-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-md"
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {isLoading ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}
