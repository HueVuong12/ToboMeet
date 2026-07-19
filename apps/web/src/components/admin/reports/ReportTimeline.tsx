"use client";

import { ProcessingLogEntry } from "@/lib/redux/api/adminApi";
import { Clock, ArrowRight, StickyNote, Scale, PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  log: ProcessingLogEntry[];
  createdAt: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportTimeline({ log, createdAt }: Props) {
  const t = useTranslations("admin.reports");

  const ACTION_CONFIG: Record<
    string,
    { label: string; icon: typeof Clock; color: string }
  > = {
    STATUS_CHANGED: {
      label: t("timeline_action_status", { fallback: "Đổi trạng thái" }),
      icon: ArrowRight,
      color: "bg-brand-100 text-brand-600",
    },
    NOTE_ADDED: {
      label: t("timeline_action_note", { fallback: "Thêm ghi chú" }),
      icon: StickyNote,
      color: "bg-amber-100 text-amber-600",
    },
    CONCLUSION_SET: {
      label: t("timeline_action_conclusion", { fallback: "Cập nhật kết luận" }),
      icon: Scale,
      color: "bg-emerald-100 text-emerald-600",
    },
  };

  const STATUS_LABELS: Record<string, string> = {
    PENDING: t("status_pending"),
    INVESTIGATING: t("status_investigating"),
    RESOLVED: t("status_resolved"),
    REJECTED: t("status_rejected"),
    CLOSED: t("status_closed"),
  };

  const allEntries = [
    {
      action: "CREATED",
      adminEmail: t("timeline_system", { fallback: "Hệ thống" }),
      timestamp: createdAt,
      note: t("timeline_created", { fallback: "Báo cáo được gửi" }),
    },
    ...log,
  ];

  const translateNote = (note?: string) => {
    if (!note) return "";
    const conclusionMap: Record<string, string> = {
      NOT_VIOLATED: t("conclusion_not_violated", { fallback: "Không vi phạm" }),
      INSUFFICIENT_EVIDENCE: t("conclusion_insufficient_evidence", { fallback: "Không đủ bằng chứng" }),
      VIOLATED: t("conclusion_violated", { fallback: "Có vi phạm" }),
    };

    let translated = note;
    
    // Thay thế tiền tố "Kết luận:" hoặc "Conclusion:" bằng nhãn i18n động
    const prefixText = t("conclusion_prefix", { fallback: "Kết luận" });
    if (translated.includes("Kết luận:")) {
      translated = translated.replace("Kết luận:", `${prefixText}:`);
    } else if (translated.includes("Conclusion:")) {
      translated = translated.replace("Conclusion:", `${prefixText}:`);
    }

    // Thứ tự check rõ ràng: check các chuỗi dài (NOT_VIOLATED, INSUFFICIENT_EVIDENCE) trước để tránh bị trùng lặp substring
    const sortedKeys = ["NOT_VIOLATED", "INSUFFICIENT_EVIDENCE", "VIOLATED"];
    sortedKeys.forEach((key) => {
      if (translated.includes(key)) {
        translated = translated.replace(key, conclusionMap[key]);
      }
    });
    return translated;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-400" />
        {t("detail_timeline")}
      </h3>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-200" />

        <div className="space-y-4">
          {allEntries.map((entry, i) => {
            const config =
              ACTION_CONFIG[entry.action] || ACTION_CONFIG.STATUS_CHANGED;
            const isFirst = i === 0;
            const Icon = isFirst ? PlusCircle : config.icon;
            const colorClass = isFirst
              ? "bg-brand-500 text-white"
              : config.color;

            return (
              <div key={i} className="relative flex items-start gap-3">
                {/* Dot */}
                <div
                  className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}
                >
                  <Icon className="w-3 h-3" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-800">
                      {isFirst
                        ? "Tạo báo cáo"
                        : entry.action === "STATUS_CHANGED" && "fromStatus" in entry
                        ? `${STATUS_LABELS[(entry as ProcessingLogEntry).fromStatus || ""] || (entry as ProcessingLogEntry).fromStatus} → ${STATUS_LABELS[(entry as ProcessingLogEntry).toStatus || ""] || (entry as ProcessingLogEntry).toStatus}`
                        : config.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{entry.adminEmail}</p>
                  {entry.note && (
                    <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                      {translateNote(entry.note)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
