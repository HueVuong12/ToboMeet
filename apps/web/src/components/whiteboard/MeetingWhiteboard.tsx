"use client";

import React, { useState, useEffect, useRef } from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { Loader2, WifiOff, X, Layers, RefreshCw } from "lucide-react";
import { useMeetingWhiteboardLogic } from "@/hooks/useMeetingWhiteboardLogic";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { useMeetingWhiteboard } from "@/components/meeting/contexts/MeetingWhiteboardContext";
import { LivekitRoomMetadata, ParticipantMetadata, WhiteboardSettings } from "@tobomeet/shared/types";
import { invalidateWhiteboardToken } from "@/lib/whiteboard/whiteboardTokenManager";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface MeetingWhiteboardProps {
  meetingCode: string;
  token?: string | null;
  whiteboardUrl?: string | null;
}

function MeetingWhiteboardCanvas({
  meetingCode,
  whiteboardUrl,
}: MeetingWhiteboardProps) {
  const { store, user, isReadOnly, leaveWhiteboard, handleRetry, t } =
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
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#161619]/90 backdrop-blur-md border border-[#232328] rounded-xl px-3 py-1.5 shadow-xl select-none">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Layers size={14} />
          </div>
          <span className="font-semibold text-xs">{t("title")}</span>
        </div>

        {isReadOnly && (
          <>
            <div className="h-4 w-px bg-[#232328]" />
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-medium">
              <span>{t("view_only_mode")}</span>
            </div>
          </>
        )}

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

export default function MeetingWhiteboard({
  meetingCode,
  whiteboardUrl,
}: MeetingWhiteboardProps) {
  const [sessionVersion, setSessionVersion] = useState(0);

  // Lắng nghe thay đổi room metadata và participant metadata từ LiveKit realtime
  const { metadata: roomMetadata } = useRoomInfo();
  const { localParticipant } = useLocalParticipant();
  const { leaveWhiteboard } = useMeetingWhiteboard();
  const t = useTranslations("meeting.whiteboard");

  const prevPermissionRef = useRef<{
    allowed: boolean;
    permLevel: "view" | "edit";
  } | null>(null);

  useEffect(() => {
    if (!roomMetadata) return;

    try {
      const meta: LivekitRoomMetadata = JSON.parse(roomMetadata);
      let wbSettings: WhiteboardSettings | undefined = undefined;

      if (meta.roomType === "breakout") {
        wbSettings = meta.parentMetadata?.whiteboardSettings;
      } else if (meta.roomType === "main") {
        wbSettings = meta.whiteboardSettings;
      }

      if (!wbSettings) return;

      let userRole: "owner" | "admin" | "member" | "guest" = "guest";
      let isHost = false;
      if (localParticipant?.metadata) {
        try {
          const userMeta: ParticipantMetadata = JSON.parse(
            localParticipant.metadata,
          );
          userRole = userMeta.role || "guest";
          isHost = userMeta.role === "owner" || userMeta.role === "admin";
        } catch {}
      }

      const allowed = isHost
        ? true
        : userRole === "member"
        ? (wbSettings.allowedRoles?.includes("member") ?? true)
        : (wbSettings.allowedRoles?.includes("guest") ?? true);

      const permLevel: "view" | "edit" = isHost
        ? "edit"
        : userRole === "member"
        ? (wbSettings.memberPermission || "edit")
        : (wbSettings.guestPermission || "edit");

      if (prevPermissionRef.current === null) {
        prevPermissionRef.current = { allowed, permLevel };
        return;
      }

      const prev = prevPermissionRef.current;
      prevPermissionRef.current = { allowed, permLevel };

      // TH1: Người dùng bị thu hồi quyền hoàn toàn
      if (prev.allowed && !allowed) {
        invalidateWhiteboardToken(meetingCode);
        toast.error(t("access_revoked_by_host"));
        leaveWhiteboard();
        return;
      }

      // TH2: Quyền thay đổi giữa Chỉ xem và Chỉnh sửa
      if (prev.allowed && allowed && prev.permLevel !== permLevel) {
        invalidateWhiteboardToken(meetingCode);
        if (permLevel === "view") {
          toast.info(t("switched_to_view_only"));
        } else {
          toast.success(t("switched_to_edit"));
        }
        // Làm mới session để tự động fetch token mới và kết nối lại
        setSessionVersion((v) => v + 1);
      }
    } catch (e) {
      console.error("Lỗi khi theo dõi thay đổi quyền Whiteboard:", e);
    }
  }, [roomMetadata, localParticipant?.metadata, meetingCode, leaveWhiteboard, t]);

  return (
    <MeetingWhiteboardCanvas
      key={sessionVersion}
      meetingCode={meetingCode}
      whiteboardUrl={whiteboardUrl}
    />
  );
}
