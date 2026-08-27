"use client";

interface DeleteEventConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  locale: string;
}

export default function DeleteEventConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  locale,
}: DeleteEventConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
      >
        <h3 className="font-bold text-slate-800 text-lg mb-3">
          {locale === "vi" ? "Hủy lịch họp" : "Cancel Meeting"}
        </h3>
        <p className="text-sm text-slate-500 mb-7 leading-relaxed">
          {locale === "vi"
            ? "Bạn có chắc chắn muốn hủy lịch họp này không? Hành động này không thể hoàn tác."
            : "Are you sure you want to cancel this meeting? This action cannot be undone."}
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
          >
            {locale === "vi" ? "Hủy" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            {locale === "vi" ? "Đồng ý" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
