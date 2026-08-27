import { ChevronLeft, ChevronRight } from "lucide-react";
import CustomTileWrapper from "./CustomTileWrapper";
import { useSelectiveSubscription } from "@/hooks/useSelectiveSubscription";

export default function CustomVideoGrid() {
  const {
    tracks,
    pages,
    currentPage,
    setCurrentPage,
    isMobile,
    pinTrack,
    isPinned,
  } = useSelectiveSubscription();

  if (tracks.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
          </div>
          <p className="text-sm">Đang đợi người khác tham gia...</p>
        </div>
      </div>
    );
  }

  const currentData = pages[currentPage];
  if (!currentData) return null;

  const handleNext = () =>
    setCurrentPage((p) => Math.min(p + 1, pages.length - 1));
  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 0));

  const getOptimalCols = (count: number, isMobile: boolean): number => {
    if (isMobile) {
      if (count === 1) return 1;
      if (count === 2) return 1;
      if (count <= 4) return 2;
      return 2;
    }
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    if (count === 4) return 2;
    if (count === 5 || count === 6) return 3;
    if (count <= 9) return 3;
    if (count <= 12) return 4;
    if (count <= 16) return 4;
    return 5;
  };

  const isSpecialPage =
    currentData.type === "screenshare" || currentData.type === "pinned";
  const count = currentData.tracks.length;
  const cols = isSpecialPage ? 1 : getOptimalCols(count, isMobile);
  const rows = Math.ceil(count / cols);

  const hasPagination = pages.length > 1;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0a0a0a] overflow-hidden">
      <div className="flex-1 flex flex-row w-full h-full min-h-0">
        {hasPagination && (
          <div className="w-10 md:w-14 shrink-0 flex items-center justify-center z-10">
            {currentPage > 0 && (
              <button
                onClick={handlePrev}
                className="w-9 h-16 md:w-11 md:h-20 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                aria-label="Trang trước"
              >
                <ChevronLeft size={isMobile ? 28 : 36} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 h-full min-h-0 p-3 md:p-4">
          <div
            className="w-full h-full grid gap-2.5 md:gap-3"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {currentData.tracks.map((t) => (
              <div
                key={`${t.participant.identity}_${t.source}`}
                className="min-w-0 min-h-0 flex"
              >
                <CustomTileWrapper
                  trackRef={t}
                  isMain={isSpecialPage}
                  isPinned={isPinned(t)}
                  onPinToggle={pinTrack}
                  className="w-full h-full bg-[#111]"
                />
              </div>
            ))}
          </div>
        </div>

        {hasPagination && (
          <div className="w-10 md:w-14 shrink-0 flex items-center justify-center z-10">
            {currentPage < pages.length - 1 && (
              <button
                onClick={handleNext}
                className="w-9 h-16 md:w-11 md:h-20 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                aria-label="Trang sau"
              >
                <ChevronRight size={isMobile ? 28 : 36} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>

      {hasPagination && (
        <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2 z-30 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
            {pages.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentPage === idx
                    ? "w-5 bg-emerald-400"
                    : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
