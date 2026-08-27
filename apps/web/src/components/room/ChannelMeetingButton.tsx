"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  Video,
  ChevronDown,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { useEnsureChannelMeetingMutation } from "@/lib/redux/api/meetingsApi";

interface ChannelMeetingButtonProps {
  roomId: string;
  channelId: string;
  isOngoing?: boolean;
  onScheduleMeeting: () => void;
}

export default function ChannelMeetingButton({
  roomId,
  channelId,
  isOngoing = false,
  onScheduleMeeting,
}: ChannelMeetingButtonProps) {
  const t = useTranslations("room");
  const router = useRouter();
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false);
  const [isJoinTooltipOpen, setIsJoinTooltipOpen] = useState(false);
  const [ensuringTarget, setEnsuringTarget] = useState<"current" | "new" | null>(
    null,
  );

  const [ensureChannelMeeting] = useEnsureChannelMeetingMutation();

  const handleStartOrJoinMeeting = async (
    target: "current" | "new" = "current",
  ) => {
    if (!roomId || !channelId) return;
    try {
      setEnsuringTarget(target);
      const res = await ensureChannelMeeting({
        roomId,
        channelId,
      }).unwrap();
      if (res?.meetingCode) {
        setIsJoinTooltipOpen(false);
        setIsMeetingMenuOpen(false);
        if (target === "new") {
          window.open(`/meeting/${res.meetingCode}`, "_blank");
        } else {
          router.push(`/meeting/${res.meetingCode}`);
        }
      }
    } catch (err: any) {
      toast.error(
        err?.data?.message || err?.message || "Không thể khởi tạo cuộc họp",
      );
    } finally {
      setEnsuringTarget(null);
    }
  };

  return (
    <div className="relative">
      {isOngoing ? (
        // TRẠNG THÁI 1: ĐANG HỌP
        <>
          <button
            disabled={!!ensuringTarget}
            onClick={() => setIsJoinTooltipOpen(!isJoinTooltipOpen)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition-colors shadow-sm shadow-amber-500/20 disabled:opacity-75 cursor-pointer disabled:cursor-not-allowed"
          >
            {ensuringTarget ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Video size={16} />
            )}
            <span>{t("btn_join")}</span>
            <ChevronDown size={14} />
          </button>

          {isJoinTooltipOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsJoinTooltipOpen(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("join_tooltip_title")}
                </div>
                <button
                  disabled={!!ensuringTarget}
                  onClick={() => handleStartOrJoinMeeting("current")}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Video size={16} className="text-amber-500 shrink-0" />
                    <span className="font-medium text-slate-800">
                      {t("join_current_tab")}
                    </span>
                  </div>
                  {ensuringTarget === "current" && (
                    <Loader2
                      size={14}
                      className="animate-spin text-amber-500 shrink-0"
                    />
                  )}
                </button>
                <button
                  disabled={!!ensuringTarget}
                  onClick={() => handleStartOrJoinMeeting("new")}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ExternalLink
                      size={16}
                      className="text-amber-500 shrink-0"
                    />
                    <span className="font-medium text-slate-800">
                      {t("join_new_tab")}
                    </span>
                  </div>
                  {ensuringTarget === "new" && (
                    <Loader2
                      size={14}
                      className="animate-spin text-amber-500 shrink-0"
                    />
                  )}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        // TRẠNG THÁI 2: KHÔNG CÓ CUỘC HỌP
        <>
          <button
            disabled={!!ensuringTarget}
            onClick={() => setIsMeetingMenuOpen(!isMeetingMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-75 cursor-pointer disabled:cursor-not-allowed"
          >
            {ensuringTarget ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Video size={16} />
            )}
            <span>{t("btn_meeting")}</span>
            <ChevronDown size={14} />
          </button>

          {isMeetingMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMeetingMenuOpen(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("start_tooltip_title")}
                </div>
                <button
                  disabled={!!ensuringTarget}
                  onClick={() => handleStartOrJoinMeeting("current")}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Video
                      size={16}
                      className="text-brand-600 shrink-0"
                    />
                    <span className="font-medium text-slate-800">
                      {t("start_current_tab")}
                    </span>
                  </div>
                  {ensuringTarget === "current" && (
                    <Loader2
                      size={14}
                      className="animate-spin text-brand-600 shrink-0"
                    />
                  )}
                </button>
                <button
                  disabled={!!ensuringTarget}
                  onClick={() => handleStartOrJoinMeeting("new")}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ExternalLink
                      size={16}
                      className="text-brand-600 shrink-0"
                    />
                    <span className="font-medium text-slate-800">
                      {t("start_new_tab")}
                    </span>
                  </div>
                  {ensuringTarget === "new" && (
                    <Loader2
                      size={14}
                      className="animate-spin text-brand-600 shrink-0"
                    />
                  )}
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    setIsMeetingMenuOpen(false);
                    onScheduleMeeting();
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Calendar
                    size={16}
                    className="text-slate-500 shrink-0"
                  />
                  <span className="font-medium text-slate-800">
                    {t("schedule_meeting")}
                  </span>
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
