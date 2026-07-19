"use client";

import { ChevronLeft, ChevronRight, Eye, ChevronUp, ChevronDown } from "lucide-react";
import { AdminReportListItem } from "@/lib/redux/api/adminApi";
import ReportStatusBadge from "./ReportStatusBadge";
import ReportTypeBadge from "./ReportTypeBadge";
import ReportSkeletonRow from "./ReportSkeletonRow";
import ReportEmptyState from "./ReportEmptyState";
import { useTranslations } from "next-intl";

interface Props {
  reports: AdminReportListItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (p: number) => void;
  onViewReport: (report: AdminReportListItem) => void;
  sortBy: string;
  sortOrder: string;
  onSort: (col: string) => void;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: string }) {
  if (sortBy !== col) return <ChevronUp className="w-3.5 h-3.5 text-slate-300" />;
  return sortOrder === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5 text-brand-500" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
  );
}

export default function ReportListTable({
  reports,
  total,
  page,
  totalPages,
  isLoading,
  onPageChange,
  onViewReport,
  sortBy,
  sortOrder,
  onSort,
}: Props) {
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

  const COLS = [
    { key: "createdAt", label: t("table_col_time", { fallback: "Thời gian" }), sortable: true },
    { key: "reporterId", label: t("table_col_reporter", { fallback: "Người báo cáo" }), sortable: false },
    { key: "reportedUserId", label: t("table_col_reported", { fallback: "Người bị báo cáo" }), sortable: false },
    { key: "reason", label: t("table_col_reason", { fallback: "Loại" }), sortable: true },
    { key: "description", label: t("table_col_desc", { fallback: "Tiêu đề / Nội dung" }), sortable: false },
    { key: "roomInfo", label: t("table_col_room", { fallback: "Phòng họp" }), sortable: false },
    { key: "status", label: t("table_col_status", { fallback: "Trạng thái" }), sortable: true },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Table header info */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <p className="text-sm text-slate-500">
          {t("table_showing", { count: reports.length, total: total, fallback: `Hiển thị ${reports.length} / ${total} báo cáo` })}
        </p>
      </div>

      {/* Responsive table wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                    col.sortable
                      ? "cursor-pointer hover:text-slate-700 select-none"
                      : ""
                  }`}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <SortIcon col={col.key} sortBy={sortBy} sortOrder={sortOrder} />
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t("table_col_action", { fallback: "Thao tác" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <ReportSkeletonRow key={i} />)
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-0">
                  <ReportEmptyState />
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr
                  key={r._id}
                  className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(r.createdAt)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 shrink-0">
                        {(r.reporter?.displayName || r.reporterId)?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                          {r.reporter?.displayName || "—"}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[120px]">
                          {r.reporter?.email || r.reporterId}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-500 shrink-0">
                        {(r.reported?.displayName || r.reportedUserId)?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                          {r.reported?.displayName || "—"}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate max-w-[120px]">
                          {r.reported?.email || r.reportedUserId}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <ReportTypeBadge reason={r.reason} size="sm" />
                  </td>

                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {r.title || getTranslatedReason(r.reason)}
                    </p>
                    {r.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {r.description}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[120px]">
                    {r.roomInfo?.roomName ? (
                      <span className="truncate block">{r.roomInfo.roomName}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <ReportStatusBadge status={r.status} size="sm" />
                  </td>

                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewReport(r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t("btn_view", { fallback: "Xem" })}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {t("table_page", { page: page, total: totalPages, fallback: `Trang ${page} / ${totalPages}` })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p =
                totalPages <= 5
                  ? i + 1
                  : page <= 3
                  ? i + 1
                  : page >= totalPages - 2
                  ? totalPages - 4 + i
                  : page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    p === page
                      ? "bg-brand-500 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
