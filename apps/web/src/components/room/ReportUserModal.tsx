"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCreateReportMutation, EvidenceDto } from "@/lib/redux/api/reportsApi";
import EvidenceUpload from "./EvidenceUpload";

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
}

export default function ReportUserModal({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName,
}: ReportUserModalProps) {
  const t = useTranslations("room");
  const [createReport, { isLoading }] = useCreateReportMutation();

  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [evidences, setEvidences] = useState<EvidenceDto[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isSubmitDisabled = isLoading || isUploading;

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitDisabled) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSubmitDisabled]);

  // Reset fields when opening
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setDescription("");
      setEvidences([]);
      setIsUploading(false);
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!reason) {
      setValidationError(t("report_error_reason_required"));
      return;
    }

    if (reason === "Khác" && !description.trim()) {
      setValidationError(t("report_error_description_required"));
      return;
    }

    try {
      await createReport({
        reportedUserId,
        reason,
        description: description.trim(),
        evidences,
        createdAt: new Date().toISOString(),
      }).unwrap();

      toast.success(t("report_success"));
      onClose();
    } catch (err: any) {
      console.error("[ReportUserModal] Gửi báo cáo thất bại:", err);
      // Xử lý thông báo lỗi từ server
      const errMsg =
        err?.data?.message ||
        err?.message ||
        "Đã xảy ra lỗi, vui lòng thử lại sau.";
      toast.error(errMsg);
      setValidationError(errMsg);

      // Nếu lỗi là do đã báo cáo trước đó, tự động đóng dialog sau 2 giây
      if (errMsg.includes("đã gửi báo cáo đối với người dùng này")) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    }
  };

  const reasons = [
    { key: "Spam", label: t("report_reason_spam") },
    { key: "Quấy rối", label: t("report_reason_harassment") },
    { key: "Ngôn từ xúc phạm", label: t("report_reason_offensive") },
    {
      key: "Chia sẻ nội dung không phù hợp",
      label: t("report_reason_inappropriate"),
    },
    { key: "Mạo danh", label: t("report_reason_impersonation") },
    { key: "Khác", label: t("report_reason_other") },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      {/* Backdrop click should close if not loading */}
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isSubmitDisabled) onClose();
        }}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col transform transition-all scale-100 duration-300 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900">
            {t("report_user_modal_title")}: {reportedUserName}
          </h3>
          <button
            disabled={isSubmitDisabled}
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Short Description */}
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          {t("report_user_modal_desc")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reasons List */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("report_reason_label")} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((r) => (
                <label
                  key={r.key}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                    reason === r.key
                      ? "border-brand-500 bg-brand-50/50 text-brand-900 ring-2 ring-brand-500/20"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.key}
                    checked={reason === r.key}
                    onChange={() => {
                      setReason(r.key);
                      setValidationError(null);
                    }}
                    className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500 focus:ring-offset-0"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Detailed description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              {t("report_description_label")}{" "}
              {reason === "Khác" && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setValidationError(null);
              }}
              placeholder={t("report_description_placeholder")}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm placeholder-slate-400"
            />
          </div>

          {/* Evidence Upload Section */}
          <EvidenceUpload
            onChange={setEvidences}
            onUploadingChange={setIsUploading}
          />

          {/* Validation Error Message */}
          {validationError && (
            <div className="text-sm font-medium text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">
              {validationError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={isSubmitDisabled}
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {t("report_cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("report_submit")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
