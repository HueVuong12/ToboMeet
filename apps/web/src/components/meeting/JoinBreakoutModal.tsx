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
  const { breakoutStartedAt, isHost } = useRoomSettings({ meetingCode: meetingCode });

  const [realTime, setRealTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState<number | null>(null);

  const { data, isLoading } = useGetBreakoutCountsQuery(
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
  }, [data?.serverTime]);

  // Chạy đếm ngược mượt mà mỗi 1 giây ở Local (áp dụng độ lệch)
  useEffect(() => {
    if (!isOpen || timeOffset === null) return;
    const interval = setInterval(() => {
      // Giờ thực tế = Giờ máy tính + Độ lệch với Server
      setRealTime(Date.now() + timeOffset);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeOffset]);

  if (!isOpen) return null;

  const myIdentity = localParticipant?.identity;

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
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[90vw] max-w-md bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl flex flex-col animate-scale-in overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#333] flex items-center justify-between bg-[#111]">
          <div className="flex items-center gap-2.5">
            <Network className="text-slate-300" size={18} />
            <h2 className="text-base font-bold text-slate-100">
              {t("modal_title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto max-h-[65vh] space-y-4 custom-scrollbar bg-[#161616]">
          {rooms && rooms.length > 0 ? (
            rooms.map((room) => {
              const currentCount = roomCounts[room.id] || 0;
              const hasLimit = room.maxParticipants > 0;
              const isFull = hasLimit && currentCount >= room.maxParticipants;
              const isCurrentlyJoining = joiningRoomId === room.id;

              // Kiểm tra quyền vào phòng: nếu có assignedUsers thì chỉ cho phép người được gán hoặc Host
              const isAssigned = Array.isArray(room.assignedUsers)
                ? (myIdentity ? room.assignedUsers.includes(myIdentity) : false)
                : true;
              const canJoin = isHost || isAssigned;

              // Tính toán lại thời gian còn lại cho phòng
              let isExpired = false;
              let timeDisplay = "";

              if (room.durationMinutes > 0 && breakoutStartedAt) {
                if (timeOffset === null) {
                  timeDisplay = "--:--";
                } else {
                  const endTime =
                    breakoutStartedAt + room.durationMinutes * 60 * 1000;
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
              } else if (room.durationMinutes > 0) {
                timeDisplay = t("duration_minutes", { count: room.durationMinutes });
              }

              // Vô hiệu hoá nút nếu: Đầy phòng, đang join, hoặc đã HẾT GIỜ
              const isDisabled = isFull || isCurrentlyJoining || isExpired;

              return (
                <div
                  key={room.id}
                  className="group flex flex-col p-4 bg-[#1f1f1f] border border-[#333] hover:border-blue-500/50 rounded-xl transition-all duration-300 hover:shadow-[0_4px_20px_-4px_rgba(59,130,246,0.15)] hover:-translate-y-0.5"
                >
                  <div className="flex flex-row items-center justify-between gap-4 mb-4">
                    {/* Tên phòng (Bên trái) */}
                    <h3 className="font-semibold text-slate-200 text-base truncate">
                      {room.name}
                    </h3>

                    {/* Thông số (Bên phải) */}
                    <div className="flex flex-row items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                        <Users size={14} className="opacity-60" />
                        <span>
                          {currentCount}{" "}
                          {hasLimit ? `/ ${room.maxParticipants}` : ""}
                        </span>
                      </div>

                      {room.durationMinutes > 0 && (
                        <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                          <Clock size={14} className="opacity-60" />
                          <span
                            className={`font-mono tracking-wider text-center ${
                              isExpired ? "opacity-50" : "w-9"
                            }`}
                          >
                            {timeDisplay}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nút Join hoặc Khóa nếu không được phân công */}
                  {canJoin ? (
                    <button
                      onClick={() => handleJoin(room.id)}
                      disabled={isDisabled}
                      className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                        isDisabled
                          ? "bg-[#333] text-slate-500 cursor-not-allowed border border-[#444]"
                          : "bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-blue-900/30 border border-blue-500 hover:border-blue-400"
                      }`}
                    >
                      {isCurrentlyJoining ? (
                        <Loader2 size={18} className="animate-spin text-white" />
                      ) : (
                        <LogIn
                          size={18}
                          className={
                            isDisabled
                              ? ""
                              : "group-hover:translate-x-1 transition-transform"
                          }
                        />
                      )}
                      {isExpired
                        ? t("room_closed")
                        : isFull
                          ? t("room_full")
                          : t("join")}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-[#18181b] text-slate-500 border border-[#2e2e33]">
                      <Lock size={14} className="text-slate-500" />
                      <span>{t("assigned_only")}</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#222] flex items-center justify-center border border-[#333]">
                <Network className="text-slate-500" size={24} />
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
