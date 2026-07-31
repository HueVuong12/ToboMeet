import { useState } from "react";
import { useTranslations } from "next-intl";

interface DataPoint {
  date: string;
  count: number;
}

interface Props {
  data: DataPoint[];
  range: string;
  setRange: (r: string) => void;
  isFetching?: boolean;
}

export default function ReportBarChart({ data, range, setRange, isFetching = false }: Props) {
  const t = useTranslations("admin.reports");
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; count: number } | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const HEIGHT = 260;

  // Tính toán các thông số thống kê dựa vào dữ liệu của range hiện tại
  const totalReports = data.reduce((sum, d) => sum + d.count, 0);
  const averageReports = (totalReports / data.length).toFixed(1);
  
  // Tìm mốc cao điểm nhất
  let peakPoint = { date: "—", count: 0 };
  data.forEach((d) => {
    if (d.count > peakPoint.count) {
      peakPoint = { date: d.date, count: d.count };
    }
  });

  const RANGES = [
    { value: "today", label: t("filter_today", { fallback: "Hôm nay" }) },
    { value: "7d", label: t("filter_7_days", { fallback: "7 ngày" }) },
    { value: "30d", label: t("filter_30_days", { fallback: "30 ngày" }) },
    { value: "3m", label: t("filter_3_months", { fallback: "3 tháng" }) },
    { value: "1y", label: t("filter_1_year", { fallback: "1 năm" }) },
  ];
  
  const PADDING_LEFT = 42;
  const PADDING_RIGHT = 24;
  const PADDING_BOTTOM = 32;
  const VIRTUAL_WIDTH = 1000;

  // Y-axis grid lines
  const gridLines = 4;
  const yLabels = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round((maxVal / gridLines) * (gridLines - i)),
  );

  // Tính toán danh sách tọa độ (x, y) của các điểm dữ liệu trên SVG dãn đều 100%
  const points = data.map((d, i) => {
    let x = PADDING_LEFT;
    if (data.length > 1) {
      x = PADDING_LEFT + i * ((VIRTUAL_WIDTH - PADDING_LEFT - PADDING_RIGHT) / (data.length - 1));
    } else {
      x = PADDING_LEFT + (VIRTUAL_WIDTH - PADDING_LEFT - PADDING_RIGHT) / 2;
    }
    // Chừa biên 55px ở trên (cho không gian tooltip) và 15px ở dưới
    const y = HEIGHT - (d.count / maxVal) * (HEIGHT - 70) - 15;
    return { x, y, date: d.date, count: d.count };
  });

  // Tạo đường vẽ chính (Line path) sử dụng đường cong Bezier bậc 3 mượt mà
  let linePath = "";
  let areaPath = "";

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    // Đóng vùng để vẽ Gradient Area phía dưới đường cong
    areaPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT} L ${points[0].x} ${HEIGHT} Z`;
  }

  // Định dạng nhãn hiển thị cho trục X và Stats Card (Ví dụ: loại bỏ chữ W đi)
  const formatXLabel = (dateStr: string) => {
    if (dateStr.startsWith("W")) {
      return dateStr.slice(1);
    }
    return dateStr;
  };

  // Định dạng ngày tháng đầy đủ cho Tooltip dựa theo range
  const formatFullDate = (dateStr: string) => {
    const currentYear = new Date().getFullYear();
    if (range === "today") {
      return `${t("filter_today", { fallback: "Hôm nay" })} - ${dateStr}`;
    }
    if (range === "7d" || range === "30d") {
      return `${dateStr}/${currentYear}`;
    }
    if (range === "3m") {
      // Nhãn Wdd/MM
      if (dateStr.startsWith("W")) {
        return `${t("timeline_week", { fallback: "Tuần" })} ${dateStr.slice(1)}/${currentYear}`;
      }
      return dateStr;
    }
    return dateStr;
  };

  return (
    <div className="relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
      {/* Header containing Title and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-slate-800">{t("chart_daily")}</h3>

        {/* Time range selector tabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200/50 self-start sm:self-auto">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              disabled={isFetching}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === r.value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini Stats Cards (matching Image 2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/80">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t("stat_total_reports", { fallback: "TỔNG SỐ BÁO CÁO" })}
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalReports}</p>
        </div>

        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/80">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t("stat_daily_average", { fallback: "TRUNG BÌNH MỖI MỐC" })}
          </p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{averageReports}</p>
        </div>

        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/80">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t("stat_peak_day", { fallback: "MỐC CAO ĐIỂM NHẤT" })}
          </p>
          <p className="text-lg font-bold text-slate-800 mt-1 truncate">
            {peakPoint.count > 0 ? `${formatXLabel(peakPoint.date)} (${peakPoint.count})` : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-[2px] bg-brand-500 inline-block" />
          <span className="text-xs text-slate-500">{t("chart_daily_legend", { fallback: "Số báo cáo" })}</span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          width="100%"
          viewBox={`0 0 ${VIRTUAL_WIDTH} ${HEIGHT + PADDING_BOTTOM + 8}`}
          className="min-w-full"
        >
          {/* Y-axis grid lines */}
          {yLabels.map((val, i) => {
            const y = (i / gridLines) * (HEIGHT - 70) + 55;
            return (
              <g key={i}>
                <line
                  x1={PADDING_LEFT - 4}
                  x2={VIRTUAL_WIDTH - PADDING_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                  strokeDasharray="4 4" // Vẽ đường nét đứt như trong hình 2
                />
                <text
                  x={PADDING_LEFT - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#94a3b8"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area Gradient Fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#areaGrad)"
              stroke="none"
            />
          )}

          {/* Smooth Line Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}

          {/* Data Points (Dots) & X-axis Labels */}
          {points.map((p, i) => {
            // Render nhãn X-axis thưa hơn nếu khoảng cách quá hẹp ở 30 ngày (render cách 1 mốc)
            const shouldRenderXLabel = range !== "30d" || i % 2 === 0 || i === points.length - 1;

            return (
              <g key={i}>
                {/* Dot background circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="white"
                  stroke={p.count > 0 ? "#6366f1" : "#cbd5e1"}
                  strokeWidth={2}
                />
                
                {/* Vùng bắt sự kiện hover vô hình có bán kính r rộng hơn (r=16) để di chuột dễ dàng hơn */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={16}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />

                {/* X-axis label */}
                {shouldRenderXLabel && (
                  <text
                    x={p.x}
                    y={HEIGHT + PADDING_BOTTOM - 2}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#94a3b8"
                  >
                    {formatXLabel(p.date)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Render Tooltip directly within SVG for 100% position accuracy with boundary checking */}
          {hoveredPoint && (() => {
            const tooltipX = Math.max(80, Math.min(VIRTUAL_WIDTH - 80, hoveredPoint.x));
            return (
              <g>
                {/* Tooltip Background Card */}
                <rect
                  x={tooltipX - 70}
                  y={hoveredPoint.y - 48}
                  width={140}
                  height={38}
                  rx={8}
                  fill="#0f172a" // slate-900
                  stroke="#1e293b" // slate-800
                  strokeWidth={1}
                />
                {/* Date label */}
                <text
                  x={tooltipX}
                  y={hoveredPoint.y - 34}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#94a3b8" // slate-400
                  fontWeight="500"
                >
                  {formatFullDate(hoveredPoint.date)}
                </text>
                {/* Value count label */}
                <text
                  x={tooltipX}
                  y={hoveredPoint.y - 20}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#818cf8" // indigo-400
                  fontWeight="bold"
                >
                  {t("chart_tooltip_count", {
                    count: hoveredPoint.count,
                    fallback: `${hoveredPoint.count} Báo cáo`,
                  })}
                </text>
                {/* Downward pointer triangle pointing precisely to the hoveredPoint.x */}
                <polygon
                  points={`${hoveredPoint.x - 6},${hoveredPoint.y - 10} ${hoveredPoint.x + 6},${hoveredPoint.y - 10} ${hoveredPoint.x},${hoveredPoint.y - 4}`}
                  fill="#0f172a"
                />
              </g>
            );
          })()}

          {/* Gradients Definition */}
          <defs>
            {/* Area Fill Gradient (Purple/Blue fade) */}
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>

            {/* Stroke Line Gradient */}
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
