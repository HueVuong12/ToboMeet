import { useState } from "react";
import { X, Plus, Trash2, Loader2, Network } from "lucide-react";
import { useStartBreakoutSessionMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";
// import { useTranslations } from "next-intl"; // Bỏ comment nếu dùng đa ngôn ngữ

export default function CreateBreakoutModal({
  isOpen,
  onClose,
  meetingCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
}) {
  // const t = useTranslations("meeting.toolbar");
  const [startBreakoutApi, { isLoading }] = useStartBreakoutSessionMutation();

  // Khởi tạo mặc định 2 phòng
  const [rooms, setRooms] = useState([
    { name: "Nhóm 1", maxParticipants: 0, durationMinutes: 0 },
    { name: "Nhóm 2", maxParticipants: 0, durationMinutes: 0 },
  ]);

  if (!isOpen) return null;

  const handleAddRoom = () => {
    setRooms([
      ...rooms,
      {
        name: `Nhóm ${rooms.length + 1}`,
        maxParticipants: 0,
        durationMinutes: 0,
      },
    ]);
  };

  const handleRemoveRoom = (indexToRemove: number) => {
    if (rooms.length <= 1) {
      toast.error("Phải có ít nhất 1 phòng thảo luận");
      return;
    }
    setRooms(rooms.filter((_, index) => index !== indexToRemove));
  };

  const handleUpdateRoom = (index: number, field: string, value: any) => {
    const updatedRooms = [...rooms];
    updatedRooms[index] = { ...updatedRooms[index], [field]: value };
    setRooms(updatedRooms);
  };

  const handleSubmit = async () => {
    // Validate cơ bản
    if (rooms.some((r) => r.name.trim() === "")) {
      toast.error("Tên phòng không được để trống");
      return;
    }

    try {
      await startBreakoutApi({
        code: meetingCode,
        rooms: rooms,
      }).unwrap();

      toast.success("Đã mở các phòng thảo luận nhóm!");
      onClose();
    } catch (error) {
      toast.error("Lỗi khi tạo phòng thảo luận. Vui lòng thử lại.");
      console.error(error);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[90vw] max-w-lg bg-[#222] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#333] flex items-center justify-between bg-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Network className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold text-white">
              Tạo phòng thảo luận (Breakout)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY (Danh sách phòng) */}
        <div className="p-5 overflow-y-auto max-h-[50vh] space-y-3 custom-scrollbar">
          {rooms.map((room, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-[#111] border border-[#333] rounded-xl relative group"
            >
              <div className="flex-1 space-y-3">
                {/* Tên phòng */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                    Tên phòng
                  </label>
                  <input
                    type="text"
                    value={room.name}
                    onChange={(e) =>
                      handleUpdateRoom(index, "name", e.target.value)
                    }
                    className="w-full bg-[#222] border border-[#444] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                    placeholder="Nhập tên nhóm..."
                  />
                </div>

                <div className="flex gap-3">
                  {/* Số người tối đa */}
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Số người tối đa (0 = Không giới hạn)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={room.maxParticipants}
                      onChange={(e) =>
                        handleUpdateRoom(
                          index,
                          "maxParticipants",
                          Number(e.target.value),
                        )
                      }
                      className="w-full bg-[#222] border border-[#444] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Thời lượng */}
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                      Thời lượng (phút, 0 = Vô hạn)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={room.durationMinutes}
                      onChange={(e) =>
                        handleUpdateRoom(
                          index,
                          "durationMinutes",
                          Number(e.target.value),
                        )
                      }
                      className="w-full bg-[#222] border border-[#444] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Nút xoá phòng */}
              <button
                onClick={() => handleRemoveRoom(index)}
                className="mt-6 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                title="Xoá phòng này"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          <button
            onClick={handleAddRoom}
            className="w-full py-2.5 border-2 border-dashed border-[#444] hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/5 text-gray-400 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors mt-2"
          >
            <Plus size={16} />
            Thêm phòng
          </button>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-[#333] bg-[#1a1a1a] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Xác nhận tạo phòng
          </button>
        </div>
      </div>
    </>
  );
}
