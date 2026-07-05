"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

interface AdminDashboardHeaderProps {
  onRefresh: () => void;
  isFetching: boolean;
}

export default function AdminDashboardHeader({
  onRefresh,
  isFetching,
}: AdminDashboardHeaderProps) {
  const t = useTranslations("admin");

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("desc")}
        </p>
      </div>

      <button
        onClick={onRefresh}
        disabled={isFetching}
        className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        <span>{t("refresh")}</span>
      </button>
    </div>
  );
}
