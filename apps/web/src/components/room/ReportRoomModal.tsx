"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import EvidenceUpload from "./EvidenceUpload";

interface ReportRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  onSubmitReport: (data: {
    reason: string;
    description: string;
    attachments: { url: string; fileName: string; fileSize: number }[];
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export default function ReportRoomModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  onSubmitReport,
  isSubmitting = false,
}: ReportRoomModalProps) {
  const t = useTranslations("room");
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [attachments, setAttachments] = useState<
    { url: string; fileName: string; fileSize: number }[]
  >([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isSubmitDisabled = isSubmitting || isUploading || !reason || (reason === "Khác" && description.trim().length < 10);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  // Reset fields when opening
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setDescription("");
      setAttachments([]);
      setIsUploading(false);
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!reason) {
      setValidationError("Vui lòng chọn một lý do vi phạm.");
      return;
    }

    if (reason === "Khác" && (!description.trim() || description.trim().length < 10)) {
      setValidationError("Vui lòng nhập lý do chi tiết (từ 10 đến 500 ký tự).");
      return;
    }

    try {
      await onSubmitReport({
        reason,
        description: description.trim(),
        attachments,
      });
      onClose();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || "Gửi báo cáo thất bại. Vui lòng thử lại.";
      setValidationError(errMsg);
    }
  };

  const reasons = [
    { key: "Quấy rối", label: "Quấy rối" },
    { key: "Spam", label: "Spam" },
    { key: "Nội dung phản cảm", label: "Nội dung phản cảm" },
    { key: "Lừa đảo", label: "Lừa đảo" },
    { key: "Chia sẻ thông tin sai sự thật", label: "Thông tin sai sự thật" },
    { key: "Vi phạm bản quyền", label: "Vi phạm bản quyền" },
    { key: "Khác", label: "Khác" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isSubmitDisabled) onClose();
        }}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col transform transition-all scale-100 duration-300 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Báo cáo phòng họp
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Phòng: <span className="font-semibold text-slate-700">{roomName}</span>
            </p>
          </div>
          <button
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed mb-4">
          Vui lòng chọn lý do vi phạm của phòng họp này. Ý kiến đóng góp của bạn giúp đội ngũ phát triển xây dựng một môi trường ToboMeet lành mạnh.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reasons */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Lý do báo cáo <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((r) => (
                <label
                  key={r.key}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
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
                    className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description details */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-semibold text-slate-700">
                Chi tiết vi phạm {reason === "Khác" && <span className="text-red-500">*</span>}
              </label>
              <span className="text-[11px] text-slate-400">
                {description.length}/500 ký tự
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setDescription(e.target.value);
                  setValidationError(null);
                }
              }}
              placeholder="Vui lòng cung cấp thêm thông tin chi tiết về hành vi vi phạm..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm placeholder-slate-400 resize-none"
            />
          </div>

          {/* Evidence upload */}
          <EvidenceUpload
            onChange={setAttachments}
            onUploadingChange={setIsUploading}
          />

          {/* Error display */}
          {validationError && (
            <div className="text-sm font-medium text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">
              {validationError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Gửi báo cáo"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
