"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface ChartDataPoint {
  date: string;
  count: number;
}

interface AdminUsageChartProps {
  data: ChartDataPoint[];
}

export default function AdminUsageChart({ data = [] }: AdminUsageChartProps) {
  const t = useTranslations("admin");
  const [filter, setFilter] = useState<"today" | "7" | "30" | "90" | "365">("30");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[300px] flex items-center justify-center text-slate-400">
        {t("no_data")}
      </div>
    );
  }

  // Lọc dữ liệu dựa trên bộ lọc đã chọn
  const filteredData = (() => {
    switch (filter) {
      case "today":
        return data.slice(-1);
      case "7":
        return data.slice(-7);
      case "30":
        return data.slice(-30);
      case "90":
        return data.slice(-90);
      case "365":
        return data.slice(-365);
      default:
        return data.slice(-30);
    }
  })();

  // Định dạng ngày hiển thị (YYYY-MM-DD -> DD/MM/YYYY)
  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Tính toán số liệu thống kê nhanh
  const totalMeetings = filteredData.reduce((sum, item) => sum + item.count, 0);
  const dailyAverage = filteredData.length > 0 
    ? (totalMeetings / filteredData.length).toFixed(1)
    : "0.0";
  
  const peakDayObj = filteredData.length > 0
    ? [...filteredData].sort((a, b) => b.count - a.count)[0]
    : null;
  const peakDayStr = peakDayObj
    ? `${formatDateFull(peakDayObj.date)} (${peakDayObj.count})`
    : "-";

  // Cấu hình kích thước SVG cố định để nội suy viewBox
  const width = 800;
  const height = 280;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...filteredData.map((d) => d.count), 5); // Tối thiểu là 5 để chart cân bằng

  // Tính toán tọa độ (x, y) cho từng điểm dữ liệu
  const points = filteredData.map((d, idx) => {
    const divisor = filteredData.length > 1 ? filteredData.length - 1 : 1;
    const x = filteredData.length === 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (idx / divisor) * chartWidth;
    const y = paddingTop + chartHeight - (d.count / maxVal) * chartHeight;
    return { x, y, data: d };
  });

  // Tạo đường dẫn vẽ biểu đồ cong mượt (Cubic Bezier)
  let linePath = "";
  let areaPath = "";

  if (points.length > 1) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      // Tọa độ điểm điều khiển để tạo độ cong mượt
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + 2 * (p1.x - p0.x) / 3;
      const cp2y = p1.y;
      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    areaPath =
      `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} ` +
      `L ${points[0].x} ${paddingTop + chartHeight} Z`;
  } else if (points.length === 1) {
    const p = points[0];
    linePath = `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y}`;
    areaPath = `M ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${paddingTop + chartHeight} L ${p.x - 20} ${paddingTop + chartHeight} Z`;
  }

  // Xác định các index hiển thị nhãn trục X
  const labelIndices = (() => {
    const len = filteredData.length;
    if (len === 0) return [];
    if (len === 1) return [0];
    if (len <= 5) {
      return Array.from({ length: len }, (_, i) => i);
    }
    return [
      0,
      Math.floor(len / 4),
      Math.floor(len / 2),
      Math.floor((len * 3) / 4),
      len - 1,
    ];
  })();

  // Chỉ hiện thị marker tĩnh khi số lượng điểm không quá nhiều (để tránh rối mắt khi xem 3 tháng/1 năm)
  const showStaticMarkers = filteredData.length <= 31;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      {/* Header & Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          {t("usage_chart_title")}
        </h2>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto self-start sm:self-auto max-w-full">
          {[
            { value: "today", label: t("filter_today") },
            { value: "7", label: t("filter_7_days") },
            { value: "30", label: t("filter_30_days") },
            { value: "90", label: t("filter_3_months") },
            { value: "365", label: t("filter_1_year") },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setFilter(opt.value as any);
                setHoveredIdx(null);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                filter === opt.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t("stat_total_meetings")}
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1">
            {totalMeetings}
          </span>
        </div>
        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t("stat_daily_average")}
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1">
            {dailyAverage}
          </span>
        </div>
        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t("stat_peak_day")}
          </span>
          <span className="text-sm font-bold text-slate-700 mt-2 truncate">
            {peakDayStr}
          </span>
        </div>
      </div>

      {/* Chart SVG */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Gradient cho vùng Area */}
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>

            {/* Gradient cho đường viền Line */}
            <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#3730a3" />
            </linearGradient>
          </defs>

          {/* Đường lưới tọa độ nằm ngang (Horizontal Gridlines) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + ratio * chartHeight;
            const gridVal = Math.round(maxVal - ratio * maxVal);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f8fafc"
                  strokeWidth="1"
                />
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400 font-medium"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Đường Area Gradient */}
          {areaPath && <path d={areaPath} fill="url(#chartAreaGradient)" />}

          {/* Đường viền Line chính */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#chartLineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Tọa độ Trục X */}
          {filteredData.length > 0 &&
            labelIndices.map((idx) => {
              const p = points[idx];
              if (!p) return null;
              const dateParts = p.data.date.split("-");
              // Hiển thị thêm năm khi xem khoảng thời gian dài (3 tháng, 1 năm)
              const label = filter === "365" || filter === "90"
                ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
                : `${dateParts[2]}/${dateParts[1]}`;
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={paddingTop + chartHeight + 22}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-400 font-semibold"
                >
                  {label}
                </text>
              );
            })}

          {/* Điểm nối & Tương tác Hover */}
          {points.map((p, idx) => (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Vùng cảm ứng vô hình (để hover dễ hơn) */}
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />

              {/* Điểm dot thực tế */}
              {hoveredIdx === idx ? (
                <>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="#4f46e5"
                    fillOpacity="0.15"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                </>
              ) : (
                showStaticMarkers && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke="#6366f1"
                    strokeWidth="1.5"
                  />
                )
              )}
            </g>
          ))}
        </svg>

        {/* Tooltip nổi bằng HTML */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute bg-slate-900 text-white rounded-xl shadow-2xl p-2.5 text-xs z-20 pointer-events-none border border-slate-800 transition-all duration-75"
            style={{
              left: `${((points[hoveredIdx].x - paddingLeft) / chartWidth) * 100}%`,
              top: `${((points[hoveredIdx].y - paddingTop) / chartHeight) * 75}%`,
              transform: "translate(-50%, -125%)",
            }}
          >
            <p className="font-semibold text-slate-300">
              {formatDateFull(points[hoveredIdx].data.date)}
            </p>
            <p className="text-[13px] font-extrabold text-indigo-400 mt-0.5">
              {points[hoveredIdx].data.count} {t("meetings")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
