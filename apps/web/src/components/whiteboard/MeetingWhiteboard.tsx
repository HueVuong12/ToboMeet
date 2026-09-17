"use client";

import React from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { Loader2, WifiOff, X, Layers, RefreshCw } from "lucide-react";
import { useMeetingWhiteboardLogic } from "@/hooks/useMeetingWhiteboardLogic";

interface MeetingWhiteboardProps {
  meetingCode: string;
  token?: string | null;
  whiteboardUrl?: string | null;
}

export default function MeetingWhiteboard({
  meetingCode,
  whiteboardUrl,
}: MeetingWhiteboardProps) {
  const { store, user, leaveWhiteboard, handleRetry, t } =
    useMeetingWhiteboardLogic({
      meetingCode,
      whiteboardUrl,
    });

  if (store.status === "loading") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0e0e11] text-white select-none">
        <div className="p-6 rounded-2xl bg-[#161619] border border-[#232328] flex flex-col items-center gap-4 max-w-sm shadow-2xl">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md -z-10" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-white mb-1">{t("loading_title")}</h3>
            <p className="text-xs text-slate-400">{t("loading_desc")}</p>
          </div>
          <button
            onClick={leaveWhiteboard}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-colors cursor-pointer"
          >
            {t("back_to_meeting")}
          </button>
        </div>
      </div>
    );
  }

  if (store.status === "error") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0e0e11] text-white p-4 select-none">
        <div className="p-6 rounded-2xl bg-[#161619] border border-red-500/30 flex flex-col items-center gap-4 max-w-md text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1.5">{t("error_title")}</h3>
            <p className="text-xs text-slate-400 mb-3">
              {store.error?.message || t("error_default_desc")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>{t("retry")}</span>
            </button>
            <button
              onClick={leaveWhiteboard}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {t("close_whiteboard")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#111113]">
      {/* Top Floating Control Bar - Canh giữa màn hình để không che khuất các menu của tldraw */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#161619]/90 backdrop-blur-md border border-[#232328] rounded-xl px-3 py-1.5 shadow-xl select-none">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Layers size={14} />
          </div>
          <span className="font-semibold text-xs">{t("title")}</span>
        </div>

        <div className="h-4 w-px bg-[#232328]" />

        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">{t("online")}</span>
        </div>

        <div className="h-4 w-px bg-[#232328]" />

        <button
          onClick={leaveWhiteboard}
          title={t("close_tooltip")}
          className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <X size={14} />
          <span className="hidden md:inline">{t("close")}</span>
        </button>
      </div>

      {/* Tldraw Canvas */}
      <div className="w-full h-full">
        <Tldraw store={store.store} user={user} autoFocus />
      </div>
    </div>
  );
}

