import { useState } from "react";
import { useGetAdminReportStatsQuery } from "@/lib/redux/api/adminApi";
import ReportStatsCards from "./ReportStatsCards";
import ReportBarChart from "./ReportBarChart";
import ReportRecentActivities from "./ReportRecentActivities";
import ReportStatusPieChart from "./ReportStatusPieChart";
import { ReportStatsSkeleton, ReportChartSkeleton } from "./ReportSkeletonRow";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ReportDashboard() {
  const t = useTranslations("admin.reports");
  const [range, setRange] = useState<string>("7d");
  const { data: stats, isLoading, refetch, isFetching } = useGetAdminReportStatsQuery({ range });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t("title")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          {t("btn_refresh", { fallback: "Làm mới" })}
        </button>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <ReportStatsSkeleton />
      ) : stats ? (
        <div className={isFetching ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
          <ReportStatsCards stats={stats} />
        </div>
      ) : null}

      {/* Bar Chart */}
      {isLoading ? (
        <ReportChartSkeleton />
      ) : stats?.chartData ? (
        <div className={isFetching ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}>
          <ReportBarChart
            data={stats.chartData}
            range={range}
            setRange={setRange}
            isFetching={isFetching}
          />
        </div>
      ) : null}

      {/* Bottom widgets grid (Recent activities and Report Type Pie Chart) */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ReportChartSkeleton />
          <ReportChartSkeleton />
        </div>
      ) : stats ? (
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${isFetching ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"}`}>
          <ReportRecentActivities activities={stats.recentActivities} isLoading={isFetching} />
          <ReportStatusPieChart byStatus={stats.byStatus} byType={stats.byType} />
        </div>
      ) : null}
    </div>
  );
}
