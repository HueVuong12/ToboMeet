"use client";

import { useState } from "react";
import { AdminReportDetail, AdminReportEvidence } from "@/lib/redux/api/adminApi";
import ReportImageLightbox from "./ReportImageLightbox";
import { Paperclip, Image, Video, FileText, Download, Eye } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  report: AdminReportDetail;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(evidence: AdminReportEvidence): "image" | "video" | "file" {
  const url = evidence.url.toLowerCase();
  const name = evidence.fileName.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(url) || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name))
    return "image";
  if (/\.(mp4|webm|ogg|mov|avi)$/.test(url) || /\.(mp4|webm|ogg|mov|avi)$/.test(name))
    return "video";
  return "file";
}

const FILE_ICONS = {
  image: Image,
  video: Video,
  file: FileText,
};

const FILE_COLORS = {
  image: "text-blue-500 bg-blue-50",
  video: "text-purple-500 bg-purple-50",
  file: "text-slate-500 bg-slate-100",
};

export default function ReportDetailEvidence({ report }: Props) {
  const t = useTranslations("admin.reports");
  const evidences = report.evidences || [];
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  const images = evidences.filter((e) => getFileType(e) === "image").map((e) => e.url);

  const openImage = (url: string) => {
    const idx = images.indexOf(url);
    setLightboxImages(images);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-slate-400" />
        {t("detail_evidence")}
        {evidences.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
            {t("detail_evidence_count", { count: evidences.length, fallback: `${evidences.length} tệp` })}
          </span>
        )}
      </h3>

      {evidences.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-center">
          <Paperclip className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400">{t("detail_evidence_empty", { fallback: "Không có bằng chứng đính kèm" })}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {evidences.map((ev, i) => {
            const type = getFileType(ev);
            const Icon = FILE_ICONS[type];
            const colorClass = FILE_COLORS[type];

            const typeLabel =
              type === "image"
                ? t("evidence_type_image", { fallback: "Hình ảnh" })
                : type === "video"
                ? t("evidence_type_video", { fallback: "Video" })
                : t("evidence_type_file", { fallback: "Tệp" });

            return (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-brand-200 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {ev.fileName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatFileSize(ev.fileSize)} · {typeLabel}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {type === "image" && (
                    <button
                      onClick={() => openImage(ev.url)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                      title="Xem ảnh lớn"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {type === "video" && (
                    <button
                      onClick={() => setVideoSrc(ev.url)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 transition-colors"
                      title="Xem video"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <a
                    href={ev.url}
                    download={ev.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                    title="Tải xuống"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImages.length > 0 && (
        <ReportImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxImages([])}
        />
      )}

      {/* Video Player */}
      {videoSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          onClick={() => setVideoSrc(null)}
        >
          <video
            src={videoSrc}
            controls
            autoPlay
            className="max-w-4xl max-h-[80vh] w-full rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
