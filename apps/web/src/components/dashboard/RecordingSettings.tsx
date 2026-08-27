import { Check, FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMeetingConfig } from "@/hooks/useMeetingConfig";
import { useIsElectron } from "@/hooks/useIsElectron";

export function RecordingSettings() {
  const t = useTranslations("settings");

  const { config, updateRecordingPath, updateRecordingFormat } =
    useMeetingConfig();

  const isElectron = useIsElectron();

  const handleSelectFolder = async () => {
    if (isElectron && (window as any).electronAPI) {
      const folderPath = await (window as any).electronAPI.selectFolder();
      if (folderPath) {
        updateRecordingPath(folderPath);
      }
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6 animate-fade-in">
      {/* Tiêu đề Tab */}
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">
          {t("recording.header")}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{t("recording.desc")}</p>
      </div>

      {/* Vị trí lưu */}
      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-slate-700">
          {t("recording.path_label")}
        </p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-600 truncate cursor-default transition-colors"
            title={config.recordingPath || t("recording.default_path")}
          >
            {config.recordingPath || t("recording.default_path")}
          </div>
          <button
            onClick={handleSelectFolder}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-medium rounded-lg border border-slate-200 transition-colors shadow-sm flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            {t("recording.change_btn")}
          </button>
        </div>
      </div>

      {/* Định dạng File */}
      <div className="space-y-2 pt-2">
        <p className="text-[13px] font-semibold text-slate-700">
          {t("recording.format_label")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* WebM Option */}
          <div
            onClick={() => updateRecordingFormat("webm")}
            className={`group cursor-pointer rounded-xl p-4 transition-all duration-200 border bg-white ${
              config.recordingFormat === "webm"
                ? "border-brand-500 shadow-[0_0_0_1px_rgba(var(--brand-500),1)]"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm"
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <span
                className={`font-bold text-base tracking-tight transition-colors ${
                  config.recordingFormat === "webm"
                    ? "text-brand-600"
                    : "text-slate-700 group-hover:text-slate-900"
                }`}
              >
                .WebM
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  config.recordingFormat === "webm"
                    ? "border-brand-500 bg-brand-500"
                    : "border-slate-300 group-hover:border-slate-400"
                }`}
              >
                {config.recordingFormat === "webm" && (
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pr-2">
              {t("recording.webm_desc")}
            </p>
          </div>

          {/* MP4 Option */}
          <div
            onClick={() => updateRecordingFormat("mp4")}
            className={`group cursor-pointer rounded-xl p-4 transition-all duration-200 border bg-white ${
              config.recordingFormat === "mp4"
                ? "border-brand-500 shadow-[0_0_0_1px_rgba(var(--brand-500),1)]"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm"
            }`}
          >
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold text-base tracking-tight transition-colors ${
                    config.recordingFormat === "mp4"
                      ? "text-brand-600"
                      : "text-slate-700 group-hover:text-slate-900"
                  }`}
                >
                  .MP4
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-700 text-[9px] font-bold tracking-wider uppercase border border-amber-200/50">
                  H.264
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  config.recordingFormat === "mp4"
                    ? "border-brand-500 bg-brand-500"
                    : "border-slate-300 group-hover:border-slate-400"
                }`}
              >
                {config.recordingFormat === "mp4" && (
                  <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pr-2">
              {t("recording.mp4_desc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
