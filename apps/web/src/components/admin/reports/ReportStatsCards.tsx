"use client";

import { Flag, Clock, Search, CheckCircle, XCircle, CalendarDays } from "lucide-react";
import { AdminReportStats } from "@/lib/redux/api/adminApi";
import { useTranslations } from "next-intl";

interface Props {
  stats: AdminReportStats;
}

export default function ReportStatsCards({ stats }: Props) {
  const t = useTranslations("admin.reports");

  const CARDS = [
    {
      key: "total",
      label: t("stats_total"),
      icon: Flag,
      color: "from-brand-500 to-indigo-600",
      iconBg: "bg-brand-500",
    },
    {
      key: "pending",
      label: t("stats_new"),
      icon: Clock,
      color: "from-amber-400 to-orange-500",
      iconBg: "bg-amber-400",
    },
    {
      key: "investigating",
      label: t("stats_investigating"),
      icon: Search,
      color: "from-blue-400 to-blue-600",
      iconBg: "bg-blue-500",
    },
    {
      key: "resolved",
      label: t("stats_resolved"),
      icon: CheckCircle,
      color: "from-emerald-400 to-teal-500",
      iconBg: "bg-emerald-500",
    },
    {
      key: "rejected",
      label: t("stats_rejected"),
      icon: XCircle,
      color: "from-red-400 to-rose-600",
      iconBg: "bg-red-500",
    },
    {
      key: "today",
      label: t("stats_today"),
      icon: CalendarDays,
      color: "from-purple-400 to-violet-600",
      iconBg: "bg-purple-500",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {CARDS.map(({ key, label, icon: Icon, iconBg }) => {
        const value = stats[key as keyof AdminReportStats] as number;
        return (
          <div
            key={key}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg} bg-opacity-10`}
              >
                <Icon className={`w-4.5 h-4.5`} style={{ color: iconBg.replace("bg-", "") }} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums">
              {value?.toLocaleString() ?? 0}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">{label}</p>
          </div>
        );
      })}
    </div>
  );
}
