"use client";

import { useState } from "react";
import { Scale, ExternalLink, Loader2 } from "lucide-react";
import { AdminReportDetail } from "@/lib/redux/api/adminApi";
import { useUpdateReportConclusionMutation } from "@/lib/redux/api/adminApi";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
  onViewUser?: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export default function ReportConclusion({
  report,
  onViewUser,
  onSuccess,
  onError,
}: Props) {
  const t = useTranslations("admin.reports");
  const [updateConclusion, { isLoading }] = useUpdateReportConclusionMutation();
  const [selected, setSelected] = useState<string>(report.conclusion || "");

  const CONCLUSION_OPTIONS = [
    {
      value: "VIOLATED",
      label: t("conclusion_violated"),
      desc: t("conclusion_violated_desc", { fallback: "Xác nhận người dùng đã vi phạm" }),
      bg: "border-red-200 bg-red-50 hover:bg-red-100",
      selected: "border-red-400 bg-red-100 ring-2 ring-red-200",
      text: "text-red-700",
      dot: "bg-red-500",
    },
    {
      value: "NOT_VIOLATED",
      label: t("conclusion_not_violated"),
      desc: t("conclusion_not_violated_desc", { fallback: "Báo cáo không có căn cứ" }),
      bg: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
      selected: "border-emerald-400 bg-emerald-100 ring-2 ring-emerald-200",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    {
      value: "INSUFFICIENT_EVIDENCE",
      label: t("conclusion_insufficient"),
      desc: t("conclusion_insufficient_desc", { fallback: "Cần thêm bằng chứng để kết luận" }),
      bg: "border-amber-200 bg-amber-50 hover:bg-amber-100",
      selected: "border-amber-400 bg-amber-100 ring-2 ring-amber-200",
      text: "text-amber-700",
      dot: "bg-amber-400",
    },
  ];

  const handleSave = async () => {
    if (!selected) return;
    try {
      await updateConclusion({ id: report._id, conclusion: selected }).unwrap();
      onSuccess?.(t("conclusion_save_success", { fallback: "Đã cập nhật kết luận thành công" }));
    } catch {
      onError?.(t("conclusion_save_failed", { fallback: "Không thể cập nhật kết luận. Vui lòng thử lại." }));
    }
  };

  const current = CONCLUSION_OPTIONS.find((o) => o.value === report.conclusion);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Scale className="w-4 h-4 text-slate-400" />
        {t("detail_conclusion")}
      </h3>

      {/* Current conclusion display */}
      {report.conclusion && current && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${current.selected} ${current.text}`}
        >
          <span className={`w-2 h-2 rounded-full ${current.dot}`} />
          {t("conclusion_current", { label: current.label, fallback: `Kết luận hiện tại: ${current.label}` })}
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-1 gap-2">
        {CONCLUSION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
              selected === opt.value ? opt.selected : opt.bg
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
              selected === opt.value ? `border-current` : "border-slate-300"
            }`}>
              {selected === opt.value && (
                <div className={`w-2 h-2 rounded-full ${opt.dot}`} />
              )}
            </div>
            <div>
              <p className={`text-xs font-bold ${opt.text}`}>{opt.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Save button */}
      {selected && selected !== report.conclusion && (
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("btn_save_conclusion")}
        </button>
      )}

      {/* View user button - only if VIOLATED */}
      {(report.conclusion === "VIOLATED" || selected === "VIOLATED") && onViewUser && (
        <button
          onClick={onViewUser}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t("btn_view_user")}
        </button>
      )}
    </div>
  );
}
