import { useHandRaise } from "@/hooks/useHandRaise";
import {
  ParticipantTile,
  TrackReferenceOrPlaceholder,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Hand,
  MicOff,
  Monitor,
  ZoomIn,
  MoreVertical,
  Pin,
  PinOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CustomTileWrapperProps {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  isMain?: boolean;
  style?: React.CSSProperties;
  isPinned?: boolean;
  onPinToggle?: (trackRef: TrackReferenceOrPlaceholder) => void;
  hideMenu?: boolean;
}

export default function CustomTileWrapper({
  trackRef,
  className,
  style,
  isMain = false,
  isPinned = false,
  onPinToggle,
  hideMenu = false,
}: CustomTileWrapperProps) {
  const participant = trackRef.participant;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const { getHandState } = useHandRaise();
  const handState = getHandState(participant);
  const isSpeaking = useIsSpeaking(participant);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Zoom bằng lăn chuột (chỉ screen share)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isScreenShare) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.002;
      const delta = -e.deltaY * zoomSensitivity;

      setScale((prev) => {
        const newScale = Math.min(Math.max(1, prev + delta), 5);
        if (newScale === 1) setPos({ x: 0, y: 0 });
        return newScale;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [isScreenShare]);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-menu-trigger]")
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isScreenShare || scale === 1) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPos({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  let avatarUrl = "";
  try {
    if (participant.metadata) {
      avatarUrl = JSON.parse(participant.metadata).avatarUrl;
    }
  } catch (error) {}

  const isCameraOff = !isScreenShare && !participant.isCameraEnabled;
  const isMicOff = !participant.isMicrophoneEnabled;

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPinToggle?.(trackRef);
    setMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`
        relative overflow-hidden rounded-xl
        transition-all duration-200 ease-out group
        ${className}
        ${
          isSpeaking && !isScreenShare
            ? "ring-[3px] ring-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.3),0_0_20px_rgba(52,211,153,0.25)] z-30"
            : "ring-1 ring-white/5"
        }
      `}
      style={{
        ...style,
        cursor:
          isScreenShare && scale > 1
            ? isDragging
              ? "grabbing"
              : "grab"
            : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Video + ẩn hoàn toàn overlay mặc định của LiveKit */}
      <div
        className="w-full h-full origin-center transition-transform duration-75 ease-out bg-[#0a0a0a]"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
        }}
      >
        <ParticipantTile
          trackRef={trackRef}
          className={`
            w-full h-full pointer-events-none
            [&_video]:!bg-[#0a0a0a]
            /* Ẩn watermark / tên mặc định của LiveKit */
            [&_.lk-participant-metadata]:!hidden
            [&_.lk-participant-placeholder]:!hidden
            [&_.lk-focus-toggle-button]:!hidden
            ${
              isMain && isScreenShare
                ? "[&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full"
                : "[&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full"
            }
          `}
        />
      </div>

      {/* Chỉ báo zoom */}
      {isScreenShare && scale > 1 && (
        <div className="absolute top-2.5 left-2.5 bg-black/70 text-white text-[11px] px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1.5 z-20 pointer-events-none border border-white/10">
          <ZoomIn size={13} className="opacity-80" />
          <span className="font-medium tabular-nums">
            {Math.round(scale * 100)}%
          </span>
        </div>
      )}

      {/* Icon giơ tay */}
      {handState.isRaised && (
        <div className="absolute top-2.5 right-2.5 bg-amber-500/95 text-white px-2.5 py-1.5 rounded-lg shadow-lg z-20 flex items-center gap-1.5 backdrop-blur-sm pointer-events-none border border-amber-400/30">
          <Hand size={14} className="fill-white animate-bounce" />
          <span className="text-[11px] font-semibold tracking-wide">
            Giơ tay
          </span>
        </div>
      )}

      {/* Menu 3 chấm */}
      {!hideMenu && onPinToggle && (
        <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            data-menu-trigger
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-colors"
            aria-label="Tùy chọn"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1.5 min-w-[140px] py-1 rounded-xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
            >
              <button
                onClick={handlePinClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-white/90 hover:bg-white/10 transition-colors"
              >
                {isPinned ? (
                  <>
                    <PinOff size={14} className="text-rose-400" />
                    <span>Bỏ ghim</span>
                  </>
                ) : (
                  <>
                    <Pin size={14} className="text-emerald-400" />
                    <span>Ghim</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Avatar khi tắt camera */}
      {isCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#121212]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.name || "User"}
              className={`
                ${isMain ? "w-36 h-36" : "w-20 h-20 sm:w-24 sm:h-24"}
                rounded-full object-cover shadow-2xl ring-2 ring-white/10
              `}
            />
          ) : (
            <div
              className={`
                ${isMain ? "w-36 h-36 text-4xl" : "w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl"}
                rounded-full bg-gradient-to-br from-slate-700 to-slate-800
                text-slate-200 flex items-center justify-center font-semibold uppercase
                shadow-2xl ring-2 ring-white/10
              `}
            >
              {participant.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
      )}

      {/* Nhãn tên (custom, thay thế watermark LiveKit) */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 py-2.5 pt-6">
          <div className="flex items-center gap-1.5 max-w-full">
            {isPinned && !isScreenShare && (
              <Pin size={12} className="text-emerald-400 shrink-0" />
            )}
            {isScreenShare ? (
              <Monitor size={13} className="text-sky-400 shrink-0" />
            ) : isMicOff ? (
              <MicOff size={13} className="text-rose-400 shrink-0" />
            ) : null}

            <span className="text-[12px] font-medium text-white/95 truncate drop-shadow-sm">
              {participant.name || "Khách"}
              {isScreenShare && (
                <span className="text-[11px] text-white/60 ml-1.5 font-normal">
                  · Đang chia sẻ
                </span>
              )}
              {isPinned && !isScreenShare && (
                <span className="text-[11px] text-emerald-400/90 ml-1.5 font-normal">
                  · Đã ghim
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
