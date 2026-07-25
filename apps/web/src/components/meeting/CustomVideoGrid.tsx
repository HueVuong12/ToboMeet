// CustomVideoGrid.tsx
import {
  TrackReferenceOrPlaceholder,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import { RemoteTrackPublication, RoomEvent, Track } from "livekit-client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import CustomTileWrapper from "./CustomTileWrapper";
import { useSelectiveSubscription } from "@/hooks/useSelectiveSubscription";

function makeKey(identity: string, source: Track.Source) {
  return `${identity}|${source}`;
}

export default function CustomVideoGrid() {
  const { tracks, pages, currentPage, setCurrentPage, isMobile } =
    useSelectiveSubscription(); // logic chính nằm trong hook

  // Tính toán render UI
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

  const getLayoutConfig = (count: number, isMobile: boolean) => {
    if (isMobile) {
      if (count === 1) return { cols: 1, rows: 1 };
      if (count === 2) return { cols: 1, rows: 2 };
      return { cols: 2, rows: 2 };
    }
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 12) return { cols: 4, rows: 3 };
    return { cols: 4, rows: 4 };
  };

  const { cols, rows: numRows } =
    currentData.type === "screenshare"
      ? { cols: 1, rows: 1 }
      : getLayoutConfig(currentData.tracks.length, isMobile);

  const rowChunks = [];
  for (let i = 0; i < currentData.tracks.length; i += cols) {
    rowChunks.push(currentData.tracks.slice(i, i + cols));
  }

  const hasPagination = pages.length > 1;

  return (
    <div className="relative w-full h-full flex flex-col bg-black overflow-hidden p-4">
      <div className="flex-1 flex flex-row w-full h-full">
        {hasPagination && (
          <div className="w-8 md:w-16 shrink-0 flex items-center justify-center h-full bg-transparent z-10 transition-all">
            {currentPage > 0 && (
              <button
                onClick={handlePrev}
                className="w-full h-24 md:h-40 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-lg"
              >
                <ChevronLeft size={isMobile ? 32 : 48} strokeWidth={1} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 h-full flex flex-col items-center justify-center overflow-hidden">
          {rowChunks.map((rowTracks, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className="flex flex-row items-center justify-center w-full"
              style={{ height: `${100 / numRows}%` }}
            >
              {rowTracks.map((t) => (
                <div
                  key={`${t.participant.identity}_${t.source}`}
                  className="flex items-center justify-center h-full"
                  style={{
                    width:
                      currentData.type === "camera" ? `${100 / cols}%` : "100%",
                  }}
                >
                  <CustomTileWrapper
                    trackRef={t}
                    isMain={currentData.type === "screenshare"}
                    className="w-full h-full border border-black bg-[#111]"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {hasPagination && (
          <div className="w-8 md:w-16 shrink-0 flex items-center justify-center h-full bg-transparent z-10 transition-all">
            {currentPage < pages.length - 1 && (
              <button
                onClick={handleNext}
                className="w-full h-24 md:h-40 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all rounded-lg"
              >
                <ChevronRight size={isMobile ? 32 : 48} strokeWidth={1} />
              </button>
            )}
          </div>
        )}
      </div>

      {hasPagination && (
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
