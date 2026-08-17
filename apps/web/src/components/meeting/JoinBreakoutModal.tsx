import { useState } from "react";
import { X, Users, Clock, LogIn, Network, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDeviceId } from "@/hooks/useDeviceId";

import {} from "@/lib/redux/api/meetingsApi";
import { useMeetingSessionContext } from "./contexts/MeetingSessionContext";

export default function JoinBreakoutModal({
  isOpen,
  onClose,
  rooms,
}: {
  isOpen: boolean;
  onClose: () => void;
  rooms: any[];
}) {
  const deviceId = useDeviceId();
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const { handleSwitchToBreakout, isJoiningBreakout } =
    useMeetingSessionContext();

  // TODO: Tích hợp API đếm số người realtime.
  // pollingInterval: 3000 giúp component tự động gọi lại API mỗi 3 giây khi modal đang mở
  /*
  const { data: roomCounts } = useGetBreakoutCountsQuery(
    { code: meetingCode },
    { skip: !isOpen, pollingInterval: 3000 } 
  );
  */
  const roomCounts: Record<string, number> = {}; // Dữ liệu giả định tạm thời

  if (!isOpen) return null;

  const handleJoin = async (breakoutRoomId: string) => {
    if (!deviceId) {
      toast.error("Không tìm thấy thiết bị, vui lòng tải lại trang.");
      return;
    }

    try {
      setJoiningRoomId(breakoutRoomId);
      await handleSwitchToBreakout(breakoutRoomId);
      onClose();
    } catch (error) {
      toast.error("Không thể tham gia phòng thảo luận lúc này.");
      console.error(error);
    } finally {
      setJoiningRoomId(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[90vw] max-w-md bg-[#222] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#333] flex items-center justify-between bg-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Network className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold text-white">
              Chọn nhóm thảo luận
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3 custom-scrollbar">
          {rooms && rooms.length > 0 ? (
            rooms.map((room) => {
              // Lấy số lượng người hiện tại từ API đếm realtime (hoặc để 0 nếu chưa có)
              const currentCount = roomCounts[room.id] || 0;
              const isFull =
                room.maxParticipants > 0 &&
                currentCount >= room.maxParticipants;
              const isCurrentlyJoining = joiningRoomId === room.id;

              return (
                <div
                  key={room.id}
                  className="flex flex-col gap-3 p-3.5 bg-[#111] border border-[#333] hover:border-[#555] rounded-xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-200 text-base">
                      {room.name}
                    </h3>

                    <button
                      onClick={() => handleJoin(room.id)}
                      disabled={isFull || isJoiningBreakout}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        isFull
                          ? "bg-red-500/10 text-red-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20"
                      }`}
                    >
                      {isCurrentlyJoining ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <LogIn size={16} />
                      )}
                      {isFull ? "Đã đầy" : "Tham gia"}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <div className="flex items-center gap-1.5 bg-[#222] px-2 py-1 rounded-md">
                      <Users
                        size={14}
                        className={isFull ? "text-red-400" : "text-emerald-400"}
                      />
                      <span
                        className={isFull ? "text-red-400" : "text-emerald-400"}
                      >
                        {currentCount}
                      </span>
                      {room.maxParticipants > 0 && (
                        <span>/ {room.maxParticipants} người</span>
                      )}
                    </div>

                    {room.durationMinutes > 0 && (
                      <div className="flex items-center gap-1.5 bg-[#222] px-2 py-1 rounded-md">
                        <Clock size={14} className="text-amber-400" />
                        <span>{room.durationMinutes} phút</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Chưa có nhóm thảo luận nào được tạo.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
