"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void>;
}

type ConfirmFunction = (options: ConfirmOptions) => void;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsLoading(false);
    setIsOpen(true);
  }, []);

  const handleCancel = () => {
    if (isLoading) return;
    setIsOpen(false);
    setOptions(null);
  };

  const handleConfirm = async () => {
    if (!options || isLoading) return;
    setIsLoading(true);
    try {
      await options.onConfirm();
      setIsOpen(false);
      setOptions(null);
    } catch (err) {
      console.error("Confirmation action error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen || isLoading) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {isOpen && options && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={handleCancel} />

          {/* Modal Box */}
          <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col z-10 p-6 overflow-hidden animate-scale-up text-left">
            {/* Close Button X */}
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              <X size={16} />
            </button>

            {/* Warning Icon & Title */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">
                {options.title || "Xác nhận xóa"}
              </h3>
            </div>

            {/* Warning Message Description */}
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              {options.message || "Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác."}
            </p>

            {/* Control buttons */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {options.cancelText || "Hủy"}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 min-w-[70px] justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Loading</span>
                  </>
                ) : (
                  <span>{options.confirmText || "Xóa"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
