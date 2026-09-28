"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CalendarX, CalendarRange, Check } from "lucide-react";

interface DeleteEventConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteType: "single" | "all") => void;
  isRecurring?: boolean;
  occurrenceDate?: string;
  locale: string;
  isLoading?: boolean;
}

export default function DeleteEventConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isRecurring = false,
  occurrenceDate,
  locale,
  isLoading = false,
}: DeleteEventConfirmModalProps) {
  const [selectedOption, setSelectedOption] = useState<"single" | "all">("single");

  useEffect(() => {
    if (isOpen) {
      setSelectedOption("single");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isVi = locale === "vi";

  const formatOccurrenceDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) return dateStr;
      const daysVi = [
        "Chủ Nhật",
        "Thứ Hai",
        "Thứ Ba",
        "Thứ Tư",
        "Thứ Năm",
        "Thứ Sáu",
        "Thứ Bảy",
      ];
      const daysEn = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayOfWeek = isVi ? daysVi[date.getDay()] : daysEn[date.getDay()];
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${dayOfWeek}, ${pad(day)}/${pad(month)}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formattedDate = formatOccurrenceDate(occurrenceDate);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            {isRecurring ? (
              <CalendarX className="w-5 h-5 text-rose-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg leading-tight">
              {isRecurring
                ? isVi
                  ? "Hủy lịch họp định kỳ"
                  : "Cancel Recurring Meeting"
                : isVi
                  ? "Hủy lịch họp"
                  : "Cancel Meeting"}
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {isRecurring
                ? isVi
                  ? "Chọn phạm vi áp dụng cho hành động này"
                  : "Choose the scope for this cancellation"
                : isVi
                  ? "Xác nhận hủy cuộc họp"
                  : "Confirm meeting cancellation"}
            </p>
          </div>
        </div>

        {isRecurring ? (
          <div className="space-y-3 my-5">
            <p className="text-xs text-slate-600 leading-relaxed">
              {isVi
                ? "Đây là một cuộc họp định kỳ. Bạn muốn hủy chỉ buổi họp này hay toàn bộ chuỗi cuộc họp?"
                : "This is a recurring meeting. Do you want to cancel only this occurrence or the entire series?"}
            </p>

            {/* Radio Options */}
            <div className="space-y-2.5 pt-1">
              {/* Option 1: Single */}
              <label
                onClick={() => setSelectedOption("single")}
                className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  selectedOption === "single"
                    ? "border-rose-500 bg-rose-50/40 text-slate-900 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-slate-700"
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      selectedOption === "single"
                        ? "border-rose-600 bg-rose-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selectedOption === "single" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-800">
                      {isVi ? "Xoá sự kiện này" : "Delete this event"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                      {isVi ? "1 buổi" : "1 instance"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {formattedDate
                      ? isVi
                        ? `Chỉ hủy buổi họp vào ${formattedDate}. Các buổi khác trong chuỗi vẫn diễn ra bình thường.`
                        : `Only cancel the meeting on ${formattedDate}. Other occurrences remain unchanged.`
                      : isVi
                        ? "Chỉ hủy riêng buổi họp được chọn này. Chuỗi sự kiện vẫn tiếp tục."
                        : "Only cancel this selected occurrence. The series will continue."}
                  </p>
                </div>
              </label>

              {/* Option 2: All */}
              <label
                onClick={() => setSelectedOption("all")}
                className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  selectedOption === "all"
                    ? "border-rose-500 bg-rose-50/40 text-slate-900 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-slate-700"
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      selectedOption === "all"
                        ? "border-rose-600 bg-rose-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selectedOption === "all" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-800">
                      {isVi ? "Xoá tất cả" : "Delete all events"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {isVi ? "Toàn chuỗi" : "All series"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {isVi
                      ? "Hủy toàn bộ tất cả các buổi họp trong chuỗi cuộc họp định kỳ này."
                      : "Delete all future and recurring events in this series."}
                  </p>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 my-6 leading-relaxed">
            {isVi
              ? "Bạn có chắc chắn muốn hủy lịch họp này không? Hành động này không thể hoàn tác."
              : "Are you sure you want to cancel this meeting? This action cannot be undone."}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isVi ? "Hủy" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isRecurring ? selectedOption : "all")}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>{isVi ? "Xác nhận" : "Confirm"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
