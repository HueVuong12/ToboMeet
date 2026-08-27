"use client";

import { RecentActivity } from "@/lib/redux/api/adminApi";
import { useTranslations } from "next-intl";
import { AlertCircle, Eye, CheckCircle, XCircle } from "lucide-react";

interface Props {
  activities?: RecentActivity[];
  isLoading?: boolean;
}

export default function ReportRecentActivities({ activities, isLoading = false }: Props) {
  const t = useTranslations("admin.reports");

  const formatActivityTime = (timestamp: string) => {
    try {
      const d = new Date(timestamp);
      const today = new Date();
      
      const isToday = 
        d.getDate() === today.getDate() && 
        d.getMonth() === today.getMonth() && 
        d.getFullYear() === today.getFullYear();

      const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      
      if (isToday) {
        return timeStr;
      }
      
      const dateStr = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
      return `${dateStr} ${timeStr}`;
    } catch {
      return "—";
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          icon: AlertCircle,
          color: "text-amber-500 bg-amber-50 border-amber-100",
          statusText: t("status_pending", { fallback: "Chờ xử lý" }),
        };
      case "INVESTIGATING":
        return {
          icon: Eye,
          color: "text-blue-500 bg-blue-50 border-blue-100",
          statusText: t("status_investigating", { fallback: "Đang xem xét" }),
        };
      case "RESOLVED":
      case "CLOSED":
        return {
          icon: CheckCircle,
          color: "text-emerald-500 bg-emerald-50 border-emerald-100",
          statusText: status === "CLOSED" ? t("status_closed", { fallback: "Đã đóng" }) : t("status_resolved", { fallback: "Đã xử lý" }),
        };
      case "REJECTED":
        return {
          icon: XCircle,
          color: "text-rose-500 bg-rose-50 border-rose-100",
          statusText: t("status_rejected", { fallback: "Từ chối" }),
        };
      default:
        return {
          icon: AlertCircle,
          color: "text-slate-500 bg-slate-50 border-slate-100",
          statusText: status,
        };
    }
  };

  const reasonKeys: Record<string, string> = {
    "Spam": "reason_spam",
    "Quấy rối": "reason_harassment",
    "Lừa đảo": "reason_scam",
    "Ngôn từ xúc phạm": "reason_offensive_speech",
    "Chia sẻ nội dung không phù hợp": "reason_inappropriate_content",
    "Nội dung không phù hợp": "reason_inappropriate_content",
    "Nội dung phản cảm": "reason_inappropriate_content_room",
    "Chia sẻ thông tin sai sự thật": "reason_fake_info",
    "Thông tin sai sự thật": "reason_fake_info",
    "Vi phạm bản quyền": "reason_copyright",
    "Mạo danh": "reason_impersonation",
    "Khác": "reason_other",
  };

  const getTranslatedReason = (reason: string) => {
    const isRoom = reason.startsWith("[Phòng]") || reason.startsWith("[Room]") || reason.includes("Room Reports");
    const cleanReason = reason.replace(/^\[(Phòng|Room|Room Reports)\]\s*/, "").trim();
    const key = reasonKeys[cleanReason];
    const translatedReason = key ? t(key, { fallback: cleanReason }) : cleanReason;
    
    if (isRoom) {
      const roomTag = t("tab_room_reports", { fallback: "Room Reports" });
      return `[${roomTag}] ${translatedReason}`;
    }
    return translatedReason;
  };

  const getActivityNote = (activity: RecentActivity) => {
    if (activity.action === "CREATED") {
      return t("timeline_created", { fallback: "Người dùng đã gửi báo cáo mới." });
    }
    
    const rawNote = activity.note || "";
    const conclusionMap: Record<string, string> = {
      NOT_VIOLATED: t("conclusion_not_violated", { fallback: "Không vi phạm" }),
      INSUFFICIENT_EVIDENCE: t("conclusion_insufficient_evidence", { fallback: "Không đủ bằng chứng" }),
      VIOLATED: t("conclusion_violated", { fallback: "Có vi phạm" }),
    };

    let translated = rawNote;
    const prefixText = t("conclusion_prefix", { fallback: "Kết luận" });
    if (translated.includes("Kết luận:")) {
      translated = translated.replace("Kết luận:", `${prefixText}:`);
    } else if (translated.includes("Conclusion:")) {
      translated = translated.replace("Conclusion:", `${prefixText}:`);
    }

    const sortedKeys = ["NOT_VIOLATED", "INSUFFICIENT_EVIDENCE", "VIOLATED"];
    sortedKeys.forEach((key) => {
      if (translated.includes(key)) {
        translated = translated.replace(key, conclusionMap[key]);
      }
    });

    if (activity.action === "STATUS_CHANGED") {
      const toText = getStatusConfig(activity.toStatus || "").statusText;
      return t("activity_status_changed_desc", { 
        to: toText, 
        fallback: `Admin đã chuyển trạng thái sang "${toText}".` 
      });
    }

    return translated || t("timeline_action_note", { fallback: "Admin đã cập nhật báo cáo." });
  };


  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-[480px]">
      <div className="shrink-0 mb-4">
        <h3 className="text-sm font-bold text-slate-800">{t("recent_activities_title", { fallback: "Hoạt động báo cáo gần đây" })}</h3>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-start animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-slate-100 rounded w-1/4" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : !activities || activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-8">
            {t("recent_activities_empty", { fallback: "Chưa có hoạt động nào." })}
          </div>
        ) : (
          <div className="space-y-4 relative pl-3 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
            {activities.map((activity) => {
              const statusConfig = getStatusConfig(activity.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <div key={activity.id} className="relative flex gap-4 items-start">
                  <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${statusConfig.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0 bg-slate-50/50 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">
                        {formatActivityTime(activity.timestamp)}
                      </span>
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded">
                        RP-{activity.reportId.slice(-5).toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 mb-1">
                      {getTranslatedReason(activity.reason)}
                    </p>

                    <p className="text-xs text-slate-600 mb-2">
                      {getActivityNote(activity)}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100/60 pt-1.5 mt-1.5">
                      <span>{activity.adminEmail || t("timeline_system", { fallback: "Hệ thống" })}</span>
                      <span className="font-semibold text-slate-500">{statusConfig.statusText}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
