"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface Props {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ReportImageLightbox({
  images,
  initialIndex = 0,
  onClose,
}: Props) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(images.length - 1, c + 1));

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-white/10 text-white text-sm font-medium">
        {current + 1} / {images.length}
      </div>

      {/* Image */}
      <div
        className="relative max-w-5xl max-h-[80vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[current]}
          alt={`Evidence ${current + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
        />
      </div>

      {/* Nav buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            disabled={current === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            disabled={current === images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Download */}
      <a
        href={images[current]}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="w-4 h-4" />
        Tải xuống
      </a>
    </div>
  );
}
