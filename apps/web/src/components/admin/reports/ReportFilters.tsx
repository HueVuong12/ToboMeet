"use client";

import { RotateCcw, Filter } from "lucide-react";
import { useTranslations } from "next-intl";

export interface ReportFilterState {
  status: string;
  reason: string;
  hasEvidence: string;
  startDate: string;
  endDate: string;
}

const DEFAULT_FILTERS: ReportFilterState = {
  status: "",
  reason: "",
  hasEvidence: "",
  startDate: "",
  endDate: "",
};

interface Props {
  filters: ReportFilterState;
  onChange: (f: ReportFilterState) => void;
}

export default function ReportFilters({ filters, onChange }: Props) {
  const t = useTranslations("admin.reports");
  const tRoom = useTranslations("room");

  const STATUSES = [
    { value: "", label: t("filter_all_status", { fallback: "Tất cả trạng thái" }) },
    { value: "PENDING", label: t("status_pending", { fallback: "Chờ xử lý" }) },
    { value: "INVESTIGATING", label: t("status_investigating", { fallback: "Đang xem xét" }) },
    { value: "RESOLVED", label: t("status_resolved", { fallback: "Đã xử lý" }) },
    { value: "REJECTED", label: t("status_rejected", { fallback: "Từ chối" }) },
    { value: "CLOSED", label: t("status_closed", { fallback: "Đã đóng" }) },
  ];

  const REASONS = [
    { value: "", label: t("filter_all_type", { fallback: "Tất cả loại" }) },
    { value: "Spam", label: tRoom("report_reason_spam", { fallback: "Spam" }) },
    { value: "Quấy rối", label: tRoom("report_reason_harassment", { fallback: "Quấy rối" }) },
    { value: "Ngôn từ xúc phạm", label: tRoom("report_reason_offensive", { fallback: "Ngôn từ xúc phạm" }) },
    { value: "Chia sẻ nội dung không phù hợp", label: tRoom("report_reason_inappropriate", { fallback: "Nội dung không phù hợp" }) },
    { value: "Mạo danh", label: tRoom("report_reason_impersonation", { fallback: "Mạo danh" }) },
    { value: "Khác", label: tRoom("report_reason_other", { fallback: "Khác" }) },
  ];

  const hasActive =
    filters.status ||
    filters.reason ||
    filters.hasEvidence ||
    filters.startDate ||
    filters.endDate;

  const update = (key: keyof ReportFilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  const reset = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-bold text-slate-700">
          {t("filter_reset", { fallback: "Bộ lọc" })}
        </span>
        {hasActive && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold">
            Đang lọc
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("table_col_status", { fallback: "Trạng thái" })}
          </label>
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 transition-all"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("table_col_reason", { fallback: "Loại báo cáo" })}
          </label>
          <select
            value={filters.reason}
            onChange={(e) => update("reason", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 transition-all"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Has Evidence */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("filter_evidence", { fallback: "Bằng chứng" })}
          </label>
          <select
            value={filters.hasEvidence}
            onChange={(e) => update("hasEvidence", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 transition-all"
          >
            <option value="">{t("filter_all", { fallback: "Tất cả" })}</option>
            <option value="true">{t("filter_has_evidence", { fallback: "Có bằng chứng" })}</option>
            <option value="false">{t("filter_no_evidence", { fallback: "Không có bằng chứng" })}</option>
          </select>
        </div>

        {/* Date range */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("filter_from_date", { fallback: "Từ ngày" })}
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("filter_to_date", { fallback: "Đến ngày" })}
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => update("endDate", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 transition-all"
          />
        </div>
      </div>

      {hasActive && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("filter_reset", { fallback: "Reset bộ lọc" })}
          </button>
        </div>
      )}
    </div>
  );
}


export { DEFAULT_FILTERS };
