"use client";

import { AdminReportStats } from "@/lib/redux/api/adminApi";
import { useTranslations } from "next-intl";

interface Props {
  byStatus: AdminReportStats["byStatus"];
  byType: AdminReportStats["byType"];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  INVESTIGATING: "#3b82f6",
  RESOLVED: "#10b981",
  REJECTED: "#ef4444",
  CLOSED: "#94a3b8",
};

const TYPE_COLORS = [
  "#0055FF", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6",
];

function PieChart({
  data,
  emptyLabel,
  totalLabel,
}: {
  data: { label: string; count: number; color: string }[];
  emptyLabel: string;
  totalLabel: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        {emptyLabel}
      </div>
    );
  }

  const cx = 160;
  const cy = 160;
  const r = 145;
  const ir = 95; // inner radius for donut

  let startAngle = -Math.PI / 2;
  const slices = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const angle = (d.count / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const ix1 = cx + ir * Math.cos(startAngle);
      const iy1 = cy + ir * Math.sin(startAngle);
      const ix2 = cx + ir * Math.cos(endAngle);
      const iy2 = cy + ir * Math.sin(endAngle);
      const large = angle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1}`,
        "Z",
      ].join(" ");

      startAngle = endAngle;
      return { ...d, path };
    });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={320} height={320} viewBox="0 0 320 320" className="shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            opacity={0.9}
            stroke="white"
            strokeWidth={2}
          />
        ))}
        <text x={cx} y={cy - 15} textAnchor="middle" fontSize={16} fill="#64748b" fontWeight="500">
          {totalLabel}
        </text>
        <text x={cx} y={cy + 25} textAnchor="middle" fontSize={36} fill="#0f172a" fontWeight="800">
          {total}
        </text>
      </svg>
      <div className="flex-1 space-y-2 min-w-[120px]">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-xs text-slate-600 flex-1 truncate">{d.label}</span>
            <span className="text-xs font-bold text-slate-800 tabular-nums">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportStatusPieChart({ byStatus, byType }: Props) {
  const t = useTranslations("admin.reports");

  const reasonKeys: Record<string, string> = {
    "Spam": "reason_spam",
    "Quấy rối": "reason_harassment",
    "Ngôn từ xúc phạm": "reason_offensive_speech",
    "Chia sẻ nội dung không phù hợp": "reason_inappropriate_content",
    "Mạo danh": "reason_impersonation",
    "Khác": "reason_other",
  };

  const getTranslatedReason = (reason: string) => {
    const key = reasonKeys[reason];
    return key ? t(key, { fallback: reason }) : reason;
  };

  const typeData = byType.slice(0, 6).map((tVal, i) => ({
    label: getTranslatedReason(tVal.type),
    count: tVal.count,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
  }));

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col h-[480px]">
      <div className="shrink-0 mb-6">
        <h3 className="text-sm font-bold text-slate-800">
          {t("chart_by_type", { fallback: "Thống kê theo loại báo cáo" })}
        </h3>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <PieChart
          data={typeData}
          emptyLabel={t("chart_empty", { fallback: "Chưa có dữ liệu" })}
          totalLabel={t("chart_total", { fallback: "Tổng" })}
        />
      </div>
    </div>
  );
}
