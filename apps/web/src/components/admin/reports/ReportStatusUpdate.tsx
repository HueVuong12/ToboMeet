"use client";

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { AdminReportDetail } from "@/lib/redux/api/adminApi";
import { useUpdateReportStatusMutation } from "@/lib/redux/api/adminApi";
import ReportStatusBadge from "./ReportStatusBadge";
import ReportConfirmModal from "./ReportConfirmModal";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export default function ReportStatusUpdate({ report, onSuccess, onError }: Props) {
  const t = useTranslations("admin.reports");

  const STATUS_TRANSITIONS: Record<string, { value: string; label: string; variant: "danger" | "warning" | "info" }[]> = {
    PENDING: [
      { value: "INVESTIGATING", label: t("status_investigating"), variant: "info" },
      { value: "REJECTED", label: t("status_rejected"), variant: "danger" },
    ],
    INVESTIGATING: [
      { value: "RESOLVED", label: t("status_resolved"), variant: "info" },
      { value: "REJECTED", label: t("status_rejected"), variant: "danger" },
      { value: "CLOSED", label: t("status_closed"), variant: "warning" },
    ],
    RESOLVED: [
      { value: "CLOSED", label: t("status_closed"), variant: "warning" },
    ],
    REJECTED: [],
    CLOSED: [],
  };

  const [updateStatus, { isLoading }] = useUpdateReportStatusMutation();
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<any>(null);

  const transitions = STATUS_TRANSITIONS[report.status] || [];

  const handleSelectStatus = (s: any) => {
    setPendingStatus(s);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingStatus) return;
    try {
      await updateStatus({
        id: report._id,
        status: pendingStatus.value,
        note: note.trim() || undefined,
      }).unwrap();
      setConfirmOpen(false);
      setNote("");
      setPendingStatus(null);
      onSuccess?.(t("status_update_success", { status: pendingStatus.label, fallback: `Đã chuyển trạng thái sang "${pendingStatus.label}"` }));
    } catch {
      setConfirmOpen(false);
      onError?.(t("status_update_failed", { fallback: "Không thể cập nhật trạng thái. Vui lòng thử lại." }));
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800">{t("detail_status_update")}</h3>

      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
        {/* Current status */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">{t("status_current", { fallback: "Hiện tại:" })}</span>
          <ReportStatusBadge status={report.status} />
        </div>

        {transitions.length === 0 ? (
          <div className="text-xs text-slate-400 py-2 text-center">
            {t("status_no_transitions", { fallback: "Báo cáo này không thể chuyển trạng thái thêm." })}
          </div>
        ) : (
          <>
            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {t("status_update_note_label", { fallback: "Ghi chú khi đổi trạng thái (tùy chọn)" })}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={t("status_update_note_placeholder", { fallback: "Nhập ghi chú nội bộ..." })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 resize-none transition-all"
              />
            </div>

            {/* Transition buttons */}
            <div className="flex flex-wrap gap-2">
              {transitions.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleSelectStatus(s)}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
                    s.variant === "danger"
                      ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      : s.variant === "warning"
                      ? "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                      : "bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200"
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirm modal */}
      <ReportConfirmModal
        open={confirmOpen}
        title={t("confirm_status_title", { fallback: "Xác nhận đổi trạng thái" })}
        description={t("confirm_status_desc", { status: pendingStatus?.label || "", fallback: `Chuyển sang "${pendingStatus?.label}"? Hành động này sẽ được ghi lại trong nhật ký xử lý.` })}
        confirmLabel={t("btn_confirm", { fallback: "Xác nhận" })}
        cancelLabel={t("btn_cancel", { fallback: "Hủy" })}
        variant={pendingStatus?.variant || "info"}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
