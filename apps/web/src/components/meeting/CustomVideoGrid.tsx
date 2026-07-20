import {
  TrackReferenceOrPlaceholder,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import CustomTileWrapper from "./CustomTileWrapper";

/**
 * COMPONENT: Lưới Video Phân Trang (Zoom-style)
 */
export default function CustomVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const pageSize = isMobile ? 6 : 8;

  const pages = useMemo(() => {
    const screenTracks = tracks.filter(
      (t) => t.source === Track.Source.ScreenShare,
    );
    const cameraTracks = tracks.filter(
      (t) => t.source !== Track.Source.ScreenShare,
    );

    const newPages: {
      type: "screenshare" | "camera";
      tracks: TrackReferenceOrPlaceholder[];
    }[] = [];

    if (screenTracks.length > 0) {
      newPages.push({ type: "screenshare", tracks: screenTracks });
    }

    for (let i = 0; i < cameraTracks.length; i += pageSize) {
      newPages.push({
        type: "camera",
        tracks: cameraTracks.slice(i, i + pageSize),
      });
    }

    return newPages;
  }, [tracks, pageSize]);

  const hasScreenShare = tracks.some(
    (t) => t.source === Track.Source.ScreenShare,
  );

  useEffect(() => {
    if (hasScreenShare) {
      setCurrentPage(0);
    }
  }, [hasScreenShare]);

  useEffect(() => {
    if (pages.length > 0 && currentPage >= pages.length) {
      setCurrentPage(pages.length - 1);
    }
  }, [pages.length, currentPage]);

  if (tracks.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-500">
        Đang đợi người khác tham gia...
      </div>
    );
  }

  const currentData = pages[currentPage];
  if (!currentData) return null;

  const handleNext = () =>
    setCurrentPage((p) => Math.min(p + 1, pages.length - 1));
  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 0));

  // 1. TÍNH TOÁN CẤU TRÚC HÀNG & CỘT
  const getLayoutConfig = (count: number, isMobile: boolean) => {
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2)
      return isMobile ? { cols: 1, rows: 2 } : { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6)
      return isMobile ? { cols: 2, rows: 3 } : { cols: 3, rows: 2 };
    return { cols: 4, rows: 2 }; // 7-8 người
  };

  const { cols, rows: numRows } =
    currentData.type === "screenshare"
      ? { cols: 1, rows: 1 }
      : getLayoutConfig(currentData.tracks.length, isMobile);

  // 2. CHIA NHỎ MẢNG VIDEO THÀNH TỪNG HÀNG (Chunking)
  const rowChunks = [];
  for (let i = 0; i < currentData.tracks.length; i += cols) {
    rowChunks.push(currentData.tracks.slice(i, i + cols));
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-[#121212] overflow-hidden">
      {/* KHU VỰC HIỂN THỊ */}
      <div
        className={`flex-1 w-full h-full flex flex-col items-center justify-center ${
          currentData.type === "camera" ? "p-1 md:p-2" : ""
        }`}
      >
        {rowChunks.map((rowTracks, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            // Sinh ra các thẻ bọc (row) ép chiều cao đều nhau
            className="flex flex-row items-center justify-center w-full"
            style={{ height: `${100 / numRows}%` }}
          >
            {rowTracks.map((t) => (
              <div
                key={`${t.participant.identity}_${t.source}`}
                // Không fix cứng width nữa, chỉ cấp maxWidth để nó tự động "teo" lại và hút sát vào nhau
                className={`flex items-center justify-center h-full transition-all duration-300 ${
                  currentData.type === "camera" ? "p-1 md:p-2" : ""
                }`}
                style={
                  currentData.type === "camera"
                    ? { maxWidth: `${100 / cols}%` }
                    : { width: "100%" }
                }
              >
                <CustomTileWrapper
                  trackRef={t}
                  isMain={currentData.type === "screenshare"}
                  className={`w-full h-full ${
                    currentData.type === "camera"
                      ? "rounded-2xl border border-slate-700/50 shadow-xl"
                      : ""
                  }`}
                  style={
                    currentData.type === "camera"
                      ? {
                          height: "100%",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          aspectRatio: "1/1",
                        }
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {currentPage > 0 && (
        <button
          onClick={handlePrev}
          className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-black/50 hover:bg-black/80 text-white rounded-full border border-slate-600/50 backdrop-blur-md transition-all z-30"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {currentPage < pages.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-2.5 md:p-3 bg-black/50 hover:bg-black/80 text-white rounded-full border border-slate-600/50 backdrop-blur-md transition-all z-30"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {pages.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2 z-30 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-full backdrop-blur-sm border border-slate-700/50">
            {pages.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentPage === idx
                    ? "w-6 bg-brand-500"
                    : "w-2 bg-slate-500/50"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
