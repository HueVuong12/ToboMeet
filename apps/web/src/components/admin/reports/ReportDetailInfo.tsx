"use client";

import { AdminReportDetail } from "@/lib/redux/api/adminApi";
import ReportStatusBadge from "./ReportStatusBadge";
import ReportTypeBadge from "./ReportTypeBadge";
import { Calendar, Hash, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportDetailInfo({ report }: Props) {
  const t = useTranslations("admin.reports");

  return (
    <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400" />
        {t("detail_info")}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ID */}
        <div className="flex items-start gap-3">
          <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 font-medium">{t("detail_info_id", { fallback: "ID Báo cáo" })}</p>
            <p className="text-xs font-mono text-slate-700 mt-0.5 break-all">{report._id}</p>
          </div>
        </div>

        {/* Created at */}
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-slate-400 font-medium">{t("detail_info_time", { fallback: "Thời gian gửi" })}</p>
            <p className="text-xs text-slate-700 mt-0.5">{formatDate(report.createdAt)}</p>
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1.5">{t("table_col_status")}</p>
          <ReportStatusBadge status={report.status} />
        </div>

        {/* Type */}
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1.5">{t("table_col_reason")}</p>
          <ReportTypeBadge reason={report.reason} />
        </div>
      </div>

      {/* Title */}
      {report.title && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1">{t("detail_info_title", { fallback: "Tiêu đề" })}</p>
          <p className="text-sm font-semibold text-slate-800">{report.title}</p>
        </div>
      )}

      {/* Description */}
      {report.description && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1">{t("table_col_desc")}</p>
          <p className="text-sm text-slate-700 leading-relaxed bg-white rounded-xl p-3 border border-slate-100">
            {report.description}
          </p>
        </div>
      )}

      {/* Resolved/Closed timestamps */}
      {report.resolvedAt && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">
          <span className="font-medium">Đã xử lý lúc:</span>
          <span>{formatDate(report.resolvedAt)}</span>
        </div>
      )}
      {report.closedAt && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 rounded-xl px-3 py-2">
          <span className="font-medium">Đã đóng lúc:</span>
          <span>{formatDate(report.closedAt)}</span>
        </div>
      )}
    </div>
  );
}
