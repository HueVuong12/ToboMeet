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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[300px] flex items-center justify-center text-slate-400">
        {t("no_data")}
      </div>
    );
  }

  // Cấu hình SVG kích thước cố định để nội suy viewBox
  const width = 800;
  const height = 280;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map((d) => d.count), 5); // Tối thiểu là 5 để chart cân bằng

  // Tính toán tọa độ (x, y) cho từng điểm dữ liệu
  const points = data.map((d, idx) => {
    const x = paddingLeft + (idx / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.count / maxVal) * chartHeight;
    return { x, y, data: d };
  });

  // Tạo đường dẫn vẽ biểu đồ (Area và Line)
  let linePath = "";
  let areaPath = "";

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
    areaPath =
      `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} ` +
      `L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 mb-6">
        {t("usage_chart_title")}
      </h2>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Gradient cho vùng Area */}
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
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
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 10}
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
          {areaPath && (
            <path d={areaPath} fill="url(#chartAreaGradient)" />
          )}

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

          {/* Tọa độ Trục X (X-Axis labels) */}
          {data.length > 0 &&
            [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor((data.length * 3) / 4), data.length - 1].map((idx) => {
              const p = points[idx];
              if (!p) return null;
              // Định dạng ngắn dd/MM
              const dateParts = p.data.date.split("-");
              const label = `${dateParts[2]}/${dateParts[1]}`;
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={paddingTop + chartHeight + 20}
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
              <circle
                cx={p.x}
                cy={p.y}
                r="12"
                fill="transparent"
              />

              {/* Điểm dot thực tế khi hover */}
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
                idx % 2 === 0 && (
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
              {points[hoveredIdx].data.date}
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
