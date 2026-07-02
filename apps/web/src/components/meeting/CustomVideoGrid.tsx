import {
  ParticipantTile,
  TrackReferenceOrPlaceholder,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Maximize2 } from "lucide-react";
import { useEffect, useState } from "react";
import CustomTileWrapper from "./CustomTileWrapper";

/**
 * COMPONENT: Lưới Video Thông Minh
 */
export default function CustomVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [focusTrack, setFocusTrack] =
    useState<TrackReferenceOrPlaceholder | null>(null);

  useEffect(() => {
    const screenShareTrack = tracks.find(
      (t) => t.source === Track.Source.ScreenShare,
    );
    if (screenShareTrack) {
      setFocusTrack(screenShareTrack);
    } else if (focusTrack?.source === Track.Source.ScreenShare) {
      setFocusTrack(null);
    }
  }, [tracks.filter((t) => t.source === Track.Source.ScreenShare).length]);

  if (tracks.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-slate-500">
        Đang đợi người khác tham gia...
      </div>
    );
  }

  const mainTrack = focusTrack || tracks[0];

  // [CẬP NHẬT LÕI Ở ĐÂY]
  // Lọc sidebar dựa trên Identity và Source thay vì so sánh object
  const sidebarTracks = tracks.filter(
    (t) =>
      t.participant.identity !== mainTrack.participant.identity ||
      t.source !== mainTrack.source,
  );

  const hasScreenShare = tracks.some(
    (t) => t.source === Track.Source.ScreenShare,
  );

  // KỊCH BẢN 1: Chỉ có 1 người duy nhất trong phòng (Và không có share screen)
  if (tracks.length === 1 && !hasScreenShare) {
    return (
      <div className="flex items-center justify-center h-full w-full p-4">
        <CustomTileWrapper
          trackRef={tracks[0]}
          className="w-full max-w-125 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50"
          isMain={true}
        />
      </div>
    );
  }

  // KỊCH BẢN 2: Nhiều người, không ai share screen
  if (!hasScreenShare) {
    return (
      <div className="flex flex-wrap content-center justify-center gap-4 p-4 h-full w-full overflow-y-auto">
        {tracks.map((t) => (
          <CustomTileWrapper
            key={`${t.participant.identity}_${t.source}`}
            trackRef={t}
            className="w-full max-w-100 min-w-50 flex-[1_1_300px] aspect-square rounded-2xl overflow-hidden border border-slate-700/50"
          />
        ))}
      </div>
    );
  }

  // KỊCH BẢN 3: Có người Share Screen (Bố cục 75 - 25)
  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-2 p-2">
      {/* Màn hình chính */}
      <div className="flex-3 relative bg-[#121212] rounded-lg overflow-hidden border border-slate-700/30 flex items-center justify-center">
        <CustomTileWrapper
          trackRef={mainTrack}
          className="w-full h-full"
          isMain={true}
        />
        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-[10px] flex items-center gap-1 z-20">
          <Maximize2 size={12} /> Tiêu điểm
        </div>
      </div>

      {/* Thanh danh sách phụ */}
      <div className="flex-1 min-w-50 max-h-50 md:max-h-full overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2 custom-scrollbar p-1">
        {sidebarTracks.map((t) => (
          <div
            key={`${t.participant.identity}_${t.source}`}
            onClick={() => setFocusTrack(t)}
            className="shrink-0 w-32 md:w-full aspect-square cursor-pointer hover:ring-2 ring-brand-500 rounded-xl overflow-hidden transition-all"
          >
            <CustomTileWrapper trackRef={t} className="w-full h-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
