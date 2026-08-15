import { NotificationResponse } from "@tobomeet/shared/types";
import {
  Bell,
  UserMinus,
  Trash2,
  Video,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLazyExchangeSessionQuery } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface NotificationCardProps {
  notification: NotificationResponse;
  onCloseDrawer: () => void;
}

export default function NotificationCard({
  notification,
  onCloseDrawer,
}: NotificationCardProps) {
  const t = useTranslations("notification");
  const router = useRouter();
  const [exchangeSession] = useLazyExchangeSessionQuery();
  const [isLoading, setIsLoading] = useState(false);

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return t("time.just_now");

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60)
      return t("time.minutes_ago", { count: diffInMinutes });

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return t("time.hours_ago", { count: diffInHours });

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays <= 30) return t("time.days_ago", { count: diffInDays });

    // Quá 30 ngày thì hiển thị đầy đủ ngày giờ
    return past.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getNotificationDetails = (
    type: string,
    metadata: Record<string, any>,
  ) => {
    switch (type) {
      case "KICKED":
        return {
          title: t("types.kicked.title"),
          content: t("types.kicked.content", {
            roomName: metadata?.roomName || "",
          }),
          icon: UserMinus,
          colorClass: "text-red-600 bg-red-100",
        };
      case "ROOM_DISBANDED":
        return {
          title: t("types.room_disbanded.title"),
          content: t("types.room_disbanded.content", {
            roomName: metadata?.roomName || t("common.room"),
          }),
          icon: Trash2,
          colorClass: "text-orange-600 bg-orange-100",
        };
      case "MEETING_INVITE":
        return {
          title: t("types.meeting_invite.title"),
          content: t("types.meeting_invite.content", {
            inviterName: metadata?.inviterName || t("common.someone"),
            roomName: metadata?.roomName || "",
          }),
          icon: Video,
          colorClass: "text-brand-600 bg-brand-100",
          sessionId: metadata?.sessionId,
          isActionable: true,
        };
      case "ROOM_REPORTED":
        return {
          title: t("types.room_reported.title"),
          content: t("types.room_reported.content"),
          icon: AlertTriangle,
          colorClass: "text-amber-600 bg-amber-100",
        };
      case "REPORT_RESOLVED":
        return {
          title: t("types.report_resolved.title"),
          content: t("types.report_resolved.content"),
          icon: CheckCircle2,
          colorClass: "text-emerald-600 bg-emerald-100",
        };
      default:
        return {
          title: t("types.system.title"),
          content: t("types.system.content", { type }),
          icon: Bell,
          colorClass: "text-slate-500 bg-slate-100",
        };
    }
  };

  const {
    title,
    content,
    icon: Icon,
    colorClass,
    isActionable,
    sessionId,
  } = getNotificationDetails(notification.type, notification.metadata || {});

  const handleActionClick = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await exchangeSession(sessionId).unwrap();

      if (response && response.meetingCode) {
        onCloseDrawer();
        router.push(`/meeting/${response.meetingCode}`);
      }
    } catch (error: any) {
      toast.error(error?.message || t("errors.session_ended"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`relative p-4 rounded-2xl border transition-all duration-200 ${
        notification.isRead
          ? "bg-white border-slate-100"
          : "bg-brand-50/40 border-brand-100/60"
      }`}
    >
      {!notification.isRead && (
        <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(0,85,255,0.4)]" />
      )}

      <div className="flex gap-3.5">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 pt-0.5">
          <h4 className="text-[13px] font-bold text-slate-800 leading-tight">
            {title}
          </h4>
          <p className="text-[12px] text-slate-600 mt-1 leading-snug">
            {content}
          </p>
          <p className="text-[10px] text-slate-400 font-medium mt-2 flex items-center gap-1">
            {formatTimeAgo(notification.updatedAt.toString())}
          </p>

          {isActionable && (
            <div className="mt-3">
              <button
                onClick={handleActionClick}
                disabled={isLoading}
                className="w-full flex items-center justify-center py-2 px-4 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("actions.join")
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
