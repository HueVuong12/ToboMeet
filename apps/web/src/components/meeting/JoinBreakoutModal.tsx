import { useEffect, useState } from "react";
import { X, Users, Clock, LogIn, Network, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useTranslations } from "next-intl";
import { useLocalParticipant } from "@livekit/components-react";

import { useGetBreakoutCountsQuery } from "@/lib/redux/api/meetingsApi";
import { useMeetingSessionContext } from "./contexts/MeetingSessionContext";
import { useRoomSettings } from "@/hooks/useRoomSettings";

export default function JoinBreakoutModal({
  isOpen,
  onClose,
  rooms,
  meetingCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  rooms: any[];
  meetingCode: string;
}) {
  const t = useTranslations("meeting.join_breakout_modal");
  const deviceId = useDeviceId();
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const { localParticipant } = useLocalParticipant();
  const { handleSwitchToBreakout } = useMeetingSessionContext();
  const { breakoutStartedAt, breakoutDuration, isHost } = useRoomSettings({
    meetingCode: meetingCode,
  });

  const [realTime, setRealTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState<number | null>(null);

  const { data } = useGetBreakoutCountsQuery(
    { code: meetingCode },
    {
      skip: !isOpen || !meetingCode,
      pollingInterval: 3000,
    },
  );

  const roomCounts = data?.counts || {};

  // Khi nhận được giờ từ Server, tính toán Độ lệch (Offset)
  useEffect(() => {
    if (data?.serverTime && timeOffset === null) {
      setTimeOffset(data.serverTime - Date.now());
    }
  }, [data?.serverTime, timeOffset]);

  // Chạy đếm ngược mượt mà mỗi 1 giây ở Local (áp dụng độ lệch)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRealTime(Date.now() + (timeOffset ?? 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeOffset]);

  if (!isOpen) return null;

  const myIdentity = localParticipant?.identity;

  // Tính toán thời gian chung cho phiên Breakout (tất cả các phòng dùng chung thời gian)
  const durationMinutes =
    rooms?.[0]?.durationMinutes || breakoutDuration || 0;
  const startedAt = breakoutStartedAt || 0;

  let isExpired = false;
  let timeDisplay: string | null = null;

  if (durationMinutes > 0 && startedAt > 0) {
    if (timeOffset === null && !data?.serverTime) {
      timeDisplay = "--:--";
    } else {
      const endTime = startedAt + durationMinutes * 60 * 1000;
      const remainingMs = endTime - realTime;

      if (remainingMs <= 0) {
        isExpired = true;
        timeDisplay = t("time_expired");
      } else {
        const totalSeconds = Math.floor(remainingMs / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        timeDisplay = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      }
    }
  }

  const handleJoin = async (breakoutRoomId: string) => {
    if (!deviceId) {
      toast.error(t("device_not_found"));
      return;
    }

    try {
      setJoiningRoomId(breakoutRoomId);
      await handleSwitchToBreakout(breakoutRoomId);
      onClose();
    } catch (error) {
      toast.error(t("join_error"));
      console.error(error);
    } finally {
      setJoiningRoomId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm animate-fade-in transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[94vw] max-w-lg bg-[#141418]/95 border border-[#2d2d38] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#262632] flex items-center justify-between bg-[#181822]/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Network size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 tracking-tight">
                {t("modal_title")}
              </h2>
              {rooms && rooms.length > 0 && (
                <p className="text-[11px] text-slate-400 font-medium">
                  {t("rooms_count", { count: rooms.length })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* THỜI GIAN ĐẾM NGƯỢC DUY NHẤT Ở HEADER */}
            {durationMinutes > 0 && timeDisplay && (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${isExpired
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-blue-500/10 border-blue-500/25 text-blue-300"
                  }`}
                title={t("time_remaining")}
              >
                <Clock
                  size={13}
                  className={
                    isExpired ? "text-red-400" : "text-blue-400 animate-pulse"
                  }
                />
                <span className="font-mono tracking-wider">{timeDisplay}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2a2a38] rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[60vh] space-y-2.5 custom-scrollbar bg-[#141418]">
          {rooms && rooms.length > 0 ? (
            rooms.map((room, index) => {
              const currentCount = roomCounts[room.id] || 0;
              const hasLimit = room.maxParticipants > 0;
              const isFull = hasLimit && currentCount >= room.maxParticipants;
              const isCurrentlyJoining = joiningRoomId === room.id;

              // Kiểm tra quyền vào phòng
              const isAssigned = Array.isArray(room.assignedUsers)
                ? myIdentity
                  ? room.assignedUsers.includes(myIdentity)
                  : false
                : true;
              const canJoin = isHost || isAssigned;

              // Vô hiệu hoá nút nếu: Đầy phòng, đang join, hoặc đã HẾT GIỜ
              const isDisabled = isFull || isCurrentlyJoining || isExpired;

              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-[#1e1e26]/80 hover:bg-[#242430] border border-[#2d2d3a] hover:border-blue-500/40 rounded-xl transition-all duration-200 group"
                >
                  {/* CỘT NỘI DUNG TRÁI: Số thứ tự + Tên phòng + Số người */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-200 text-sm truncate group-hover:text-white transition-colors">
                          {room.name}
                        </h3>
                        {Array.isArray(room.assignedUsers) &&
                          room.assignedUsers.length > 0 &&
                          isAssigned && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium shrink-0">
                              {t("assigned_only")}
                            </span>
                          )}
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-0.5">
                        <Users size={12} className="text-slate-500 shrink-0" />
                        <span>
                          {currentCount}
                          {hasLimit ? ` / ${room.maxParticipants}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CỘT PHẢI: Nút Thao tác trên cùng 1 hàng */}
                  <div className="shrink-0">
                    {canJoin ? (
                      <button
                        onClick={() => handleJoin(room.id)}
                        disabled={isDisabled}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${isDisabled
                          ? "bg-[#282834] text-slate-500 border border-[#383846] cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-blue-500/20 active:scale-95 border border-blue-500 hover:border-blue-400 cursor-pointer"
                          }`}
                      >
                        {isCurrentlyJoining ? (
                          <Loader2
                            size={14}
                            className="animate-spin text-white"
                          />
                        ) : (
                          <LogIn
                            size={14}
                            className={
                              isDisabled
                                ? ""
                                : "group-hover:translate-x-0.5 transition-transform"
                            }
                          />
                        )}
                        <span>
                          {isExpired
                            ? t("room_closed")
                            : isFull
                              ? t("room_full")
                              : t("join")}
                        </span>
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-[#181820] text-slate-500 border border-[#2b2b36]">
                        <Lock size={12} className="text-slate-500" />
                        <span>{t("assigned_only")}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1e1e28] flex items-center justify-center border border-[#2d2d3c]">
                <Network className="text-slate-500" size={22} />
              </div>
              <p className="text-slate-400 text-sm font-medium">
                {t("no_rooms_created")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

