import { useHandRaise } from "@/hooks/useHandRaise";
import {
  ParticipantTile,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Hand, MicOff, Monitor } from "lucide-react";

/**
 * COMPONENT: Wrapper thông minh cho từng ô Video
 * Xử lý: Ép khung hình vuông, hiển thị Avatar khi tắt Camera, Hiển thị nhãn tên
 */
export default function CustomTileWrapper({
  trackRef,
  className,
  isMain = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  isMain?: boolean;
}) {
  const participant = trackRef.participant;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const { getHandState } = useHandRaise();
  const handState = getHandState(participant);

  // Giải mã Avatar từ metadata
  let avatarUrl = "";
  try {
    if (participant.metadata) {
      avatarUrl = JSON.parse(participant.metadata).avatarUrl;
    }
  } catch (error) {}

  // Kiểm tra xem camera và mic có đang tắt hay không
  const isCameraOff = !isScreenShare && !participant.isCameraEnabled;
  const isMicOff = !participant.isMicrophoneEnabled;

  return (
    <div className={`relative bg-[#1a1a1a] ${className}`}>
      {/* 1. Tile mặc định của LiveKit */}
      <ParticipantTile
        trackRef={trackRef}
        className="w-full h-full"
        // Nếu là màn hình Share chính thì giữ nguyên tỷ lệ (contain), còn camera thì cắt vuông (cover)
        style={{
          objectFit: isMain && isScreenShare ? "contain" : "cover",
        }}
      />

      {/* ICON BÀN TAY HIỂN THỊ TRÊN GÓC VIDEO */}
      {handState.isRaised && (
        <div className="absolute top-2 right-2 bg-amber-500/90 text-white p-1.5 rounded-lg shadow-lg shadow-amber-500/30 z-20 flex items-center gap-1.5 border border-amber-400 backdrop-blur-md">
          <Hand size={14} className="fill-white animate-bounce" />
          <span className="text-xs font-bold">Giơ tay</span>
        </div>
      )}

      {/* 2. Lớp Overlay hiển thị Avatar (Chỉ hiện khi tắt Camera) */}
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

      {/* 3. NHÃN TÊN NGƯỜI DÙNG (GÓC TRÁI DƯỚI CÙNG) */}
      <div className="absolute bottom-2 left-2 z-20 max-w-[90%] bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex items-center gap-2 border border-slate-700/50 shadow-sm pointer-events-none">
        {/* Nếu đang share màn hình thì hiện icon Monitor, nếu tắt mic thì hiện icon Mic bị gạch */}
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
