import { useHandRaise } from "@/hooks/useHandRaise";
import {
  ParticipantTile,
  TrackReferenceOrPlaceholder,
  useIsSpeaking,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Hand, MicOff, Monitor, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * COMPONENT: Wrapper thông minh cho từng ô Video
 * Tích hợp Zoom (Lăn chuột) & Pan (Kéo thả) cho màn hình chia sẻ
 */
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

  // Xử lý Lăn chuột để Zoom (Chỉ áp dụng cho màn hình Share)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isScreenShare) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Ngăn trình duyệt cuộn trang
      const zoomSensitivity = 0.002;
      const delta = -e.deltaY * zoomSensitivity;

      setScale((prev) => {
        const newScale = Math.min(Math.max(1, prev + delta), 5); // Tối đa zoom 5x
        if (newScale === 1) setPos({ x: 0, y: 0 }); // Zoom out hết cỡ thì reset vị trí
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

  // Giải mã Avatar từ metadata
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
      className={`relative bg-[#1a1a1a] overflow-hidden transition-all duration-300 ${className} ${
        isSpeaking && !isScreenShare
          ? "ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] z-30"
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
      {/* 1. LỚP CHỨA VIDEO: Bọc transform để xử lý Zoom và Kéo */}
      <div
        className="w-full h-full origin-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
        }}
      >
        <ParticipantTile
          trackRef={trackRef}
          // Dùng class [&_video] để ép CSS trực tiếp vào thẻ <video> nằm sâu bên trong component của LiveKit
          className={`w-full h-full pointer-events-none ${
            isMain && isScreenShare
              ? "[&_video]:!object-contain [&_video]:!bg-black [&_video]:!w-full [&_video]:!h-full"
              : "[&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full"
          }`}
        />
      </div>

      {/* CHỈ BÁO MỨC ZOOM */}
      {isScreenShare && scale > 1 && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-md flex items-center gap-1 z-20 pointer-events-none">
          <ZoomIn size={12} /> {Math.round(scale * 100)}%
        </div>
      )}

      {/* 2. ICON GIƠ TAY */}
      {handState.isRaised && (
        <div className="absolute top-2 right-2 bg-amber-500/90 text-white p-1.5 rounded-lg shadow-lg shadow-amber-500/30 z-20 flex items-center gap-1.5 border border-amber-400 backdrop-blur-md pointer-events-none">
          <Hand size={14} className="fill-white animate-bounce" />
          <span className="text-xs font-bold">Giơ tay</span>
        </div>
      )}

      {/* 3. AVATAR KHI TẮT CAMERA */}
      {isCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#1f1f1f]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.name}
              className={`${
                isMain ? "w-40 h-40" : "w-24 h-24"
              } rounded-full object-cover border-[3px] border-slate-700 shadow-xl`}
            />
          ) : (
            <div
              className={`${
                isMain ? "w-40 h-40 text-5xl" : "w-24 h-24 text-3xl"
              } rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-bold uppercase border-[3px] border-brand-600/30 shadow-xl`}
            >
              {participant.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
      )}

      {/* 4. NHÃN TÊN NGƯỜI DÙNG */}
      <div className="absolute bottom-2 left-2 z-20 max-w-[90%] bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700/50 shadow-sm pointer-events-none">
        {isScreenShare ? (
          <Monitor size={14} className="text-blue-400 shrink-0" />
        ) : isMicOff ? (
          <MicOff size={14} className="text-red-400 shrink-0" />
        ) : null}

        <span className="text-xs font-medium text-white truncate">
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
