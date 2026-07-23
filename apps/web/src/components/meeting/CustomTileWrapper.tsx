import { useHandRaise } from "@/hooks/useHandRaise";
import {
  ParticipantTile,
  TrackReferenceOrPlaceholder,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Hand, MicOff, Monitor, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function CustomTileWrapper({
  trackRef,
  className,
  style,
  isMain = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  isMain?: boolean;
  style?: React.CSSProperties;
}) {
  const participant = trackRef.participant;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const { getHandState } = useHandRaise();
  const handState = getHandState(participant);
  const isSpeaking = useIsSpeaking(participant);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Xử lý Lăn chuột để Zoom
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

  // Xử lý kéo thả (Pan)
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

  return (
    <div
      ref={containerRef}
      // Dùng ring-inset để viền báo hiệu người nói ôm trọn vào trong mép video như Zoom
      className={`relative overflow-hidden ${className} ${
        isSpeaking && !isScreenShare
          ? "ring-[3px] ring-green-500 ring-inset z-30"
          : "border-transparent"
      }`}
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
      {/* 1. LỚP CHỨA VIDEO */}
      <div
        className="w-full h-full origin-center transition-transform duration-75 ease-out bg-black"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
        }}
      >
        <ParticipantTile
          trackRef={trackRef}
          // Dùng object-cover để video lắp đầy ô hình chữ nhật, ko bị xuất hiện viền đen dư thừa
          className={`w-full h-full pointer-events-none [&_video]:!bg-black ${
            isMain && isScreenShare
              ? "[&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full"
              : "[&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full"
          }`}
        />
      </div>

      {/* CHỈ BÁO MỨC ZOOM */}
      {isScreenShare && scale > 1 && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1 z-20 pointer-events-none">
          <ZoomIn size={12} /> {Math.round(scale * 100)}%
        </div>
      )}

      {/* 2. ICON GIƠ TAY */}
      {handState.isRaised && (
        <div className="absolute top-2 right-2 bg-amber-500/90 text-white p-1.5 rounded shadow-lg z-20 flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
          <Hand size={14} className="fill-white animate-bounce" />
          <span className="text-[10px] font-bold uppercase">Giơ tay</span>
        </div>
      )}

      {/* 3. AVATAR KHI TẮT CAMERA */}
      {isCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#1a1a1a]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.name}
              className={`${
                isMain ? "w-40 h-40" : "w-24 h-24"
              } rounded-full object-cover shadow-xl`}
            />
          ) : (
            <div
              className={`${
                isMain ? "w-40 h-40 text-5xl" : "w-24 h-24 text-3xl"
              } rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold uppercase shadow-xl`}
            >
              {participant.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
      )}

      {/* 4. NHÃN TÊN NGƯỜI DÙNG CHUẨN ZOOM */}
      <div className="absolute bottom-0 left-0 z-20 max-w-[100%] bg-black/70 px-2 py-1 flex items-center gap-1.5 pointer-events-none">
        {isScreenShare ? (
          <Monitor size={12} className="text-blue-400 shrink-0" />
        ) : isMicOff ? (
          <MicOff size={12} className="text-red-500 shrink-0" />
        ) : null}

        <span className="text-[11px] font-medium text-white truncate drop-shadow-sm">
          {participant.name || "Khách"}
          {isScreenShare && (
            <span className="text-[10px] text-slate-300 ml-1 font-normal">
              (Đang chia sẻ)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
