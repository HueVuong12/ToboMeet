"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  FileSpreadsheet,
  ListTree,
  Table,
  Check,
  Loader2,
  X,
  Languages,
} from "lucide-react";

export type ExportMode = "detailed" | "minimal";
export type ExportLanguage = "vi" | "en" | string;

export interface ExportAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { lang: string; mode: ExportMode }) => Promise<void>;
  isExporting?: boolean;
  defaultLang?: string;
}

const AVAILABLE_LANGUAGES: Array<{
  code: ExportLanguage;
  nameKey: string;
  flag: string;
}> = [
    { code: "vi", nameKey: "session_export_lang_vi", flag: "🇻🇳" },
    { code: "en", nameKey: "session_export_lang_en", flag: "en" },
  ];

export default function ExportAttendanceModal({
  isOpen,
  onClose,
  onConfirm,
  isExporting = false,
  defaultLang = "vi",
}: ExportAttendanceModalProps) {
  const t = useTranslations("room");

  const [mode, setMode] = useState<ExportMode>("detailed");
  const [lang, setLang] = useState<ExportLanguage>(
    defaultLang === "en" ? "en" : "vi",
  );

  if (!isOpen) return null;

  const handleExport = async () => {
    await onConfirm({ lang, mode });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t("session_export_modal_title", {
                  defaultValue: "Tùy chỉnh xuất file Excel",
                })}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {t("session_export_modal_subtitle", {
                  defaultValue:
                    "Chọn định dạng báo cáo và ngôn ngữ tiêu đề cột",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          {/* Section: Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("session_export_mode_label", {
                defaultValue: "Chế độ xuất dữ liệu",
              })}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Detailed Option Card */}
              <div
                onClick={() => !isExporting && setMode("detailed")}
                className={`relative flex flex-col justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${mode === "detailed"
                  ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  } ${isExporting ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${mode === "detailed"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600"
                          }`}
                      >
                        <ListTree className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {t("session_export_mode_detailed", {
                          defaultValue: "Chi tiết",
                        })}
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${mode === "detailed"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300 bg-white"
                        }`}
                    >
                      {mode === "detailed" && <Check className="w-3 h-3" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {t("session_export_mode_detailed_desc", {
                      defaultValue:
                        "Bao gồm chi tiết từng lượt tham gia, thời gian vào/ra và thời lượng của mỗi lượt.",
                    })}
                  </p>
                </div>
              </div>

              {/* Minimal Option Card */}
              <div
                onClick={() => !isExporting && setMode("minimal")}
                className={`relative flex flex-col justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${mode === "minimal"
                  ? "border-emerald-600 bg-emerald-50/40 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  } ${isExporting ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${mode === "minimal"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600"
                          }`}
                      >
                        <Table className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {t("session_export_mode_minimal", {
                          defaultValue: "Tối giản",
                        })}
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${mode === "minimal"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300 bg-white"
                        }`}
                    >
                      {mode === "minimal" && <Check className="w-3 h-3" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {t("session_export_mode_minimal_desc", {
                      defaultValue:
                        "Chỉ hiển thị thời gian vào đầu tiên, thời gian ra cuối cùng, tổng thời lượng và số lượt vào.",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Language Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Languages className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {t("session_export_lang_label", {
                  defaultValue: "Ngôn ngữ tiêu đề cột",
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_LANGUAGES.map((item) => {
                const isSelected = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    disabled={isExporting}
                    onClick={() => setLang(item.code)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${isSelected
                      ? "border-brand-600 bg-brand-50/50 text-brand-900 font-bold shadow-2xs"
                      : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      } disabled:opacity-50`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base leading-none">{item.flag}</span>
                      <span>
                        {t(item.nameKey, { defaultValue: item.code })}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {t("session_export_btn_cancel", { defaultValue: "Hủy" })}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>
              {t("session_export_btn_confirm", { defaultValue: "Xuất file Excel" })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
