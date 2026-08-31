"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps {
  label: string;
  id: string;
  name: string;
  value: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function PasswordField({
  label,
  id,
  name,
  value,
  placeholder,
  error,
  disabled,
  onChange,
  onBlur,
}: PasswordFieldProps) {
  // Moi instance PasswordField tu quan ly trang thai show/hide rieng
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold text-slate-700"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-[13px] text-slate-800 bg-white placeholder:text-slate-400 transition-all duration-200 outline-none
            ${
              error
                ? "border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
                : "border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            }
            ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}
          `}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={isVisible ? "An mat khau" : "Hien mat khau"}
          onClick={() => setIsVisible((v) => !v)}
          disabled={disabled}
          className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors disabled:pointer-events-none"
        >
          {isVisible ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="min-h-[18px]">
        {error && (
          <p className="text-[12px] text-red-500 leading-tight">{error}</p>
        )}
      </div>
    </div>
  );
}
