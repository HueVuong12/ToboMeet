import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Network,
  Users,
  Wand2,
  Hand,
  Settings,
  Clock,
} from "lucide-react";
import { useStartBreakoutSessionMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";
import { useParticipantManager } from "@/hooks/useParticipantManager";
import { CreateBreakoutRoomDto } from "@tobomeet/shared/types";

export default function CreateBreakoutModal({
  isOpen,
  onClose,
  meetingCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
}) {
  const { displayParticipants: participants } = useParticipantManager({
    meetingCode: meetingCode,
  });
  const [startBreakoutApi, { isLoading }] = useStartBreakoutSessionMutation();

  const [activeTab, setActiveTab] = useState<"auto" | "manual" | "self">(
    "auto",
  );

  // STATE CHẾ ĐỘ 1: TỰ ĐỘNG (AUTO)
  const [autoConfig, setAutoConfig] = useState({
    roomCount: 2,
    maxParticipants: 2,
    durationMinutes: 10,
  });
  // Checkbox tự động "bế" người dùng
  const [isAutoAssign, setIsAutoAssign] = useState(true);

  // STATE CHẾ ĐỘ 2: THỦ CÔNG (MANUAL)
  const [manualRooms, setManualRooms] = useState([
    { id: "room-1", name: "Nhóm 1", durationMinutes: 10 },
    { id: "room-2", name: "Nhóm 2", durationMinutes: 10 },
  ]);
  const [manualAssignments, setManualAssignments] = useState<
    Record<string, string>
  >({});
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [draggedOverRoom, setDraggedOverRoom] = useState<string | null>(null);

  // STATE CHẾ ĐỘ 3: TỰ CHỌN (SELF)
  const [selfRooms, setSelfRooms] = useState([
    { name: "Nhóm 1", maxParticipants: 2, durationMinutes: 10 },
    { name: "Nhóm 2", maxParticipants: 2, durationMinutes: 10 },
  ]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.DragEvent, userId: string) => {
    setDraggedUserId(userId);
    e.dataTransfer.setData("userId", userId);
  };

  const handleDragOver = (e: React.DragEvent, roomId: string | null) => {
    e.preventDefault();
    setDraggedOverRoom(roomId);
  };

  const handleDrop = (e: React.DragEvent, targetRoomId: string | null) => {
    e.preventDefault();
    const userId = e.dataTransfer.getData("userId");
    setDraggedOverRoom(null);
    setDraggedUserId(null);

    if (userId) {
      setManualAssignments((prev) => {
        const next = { ...prev };
        if (targetRoomId) next[userId] = targetRoomId;
        else delete next[userId];
        return next;
      });
    }
  };

  // Tạo phòng
  const handleSubmit = async () => {
    let finalRoomsPayload: CreateBreakoutRoomDto[] = [];

    if (activeTab === "auto") {
      if (autoConfig.roomCount < 1) return toast.error("Cần ít nhất 1 phòng");
      if (autoConfig.durationMinutes < 1)
        return toast.error("Thời gian tối thiểu 1 phút");

      const shuffled = [...participants].sort(() => 0.5 - Math.random());
      finalRoomsPayload = Array.from(
        { length: autoConfig.roomCount },
        (_, i) => ({
          name: `Nhóm ${i + 1}`,
          maxParticipants: autoConfig.maxParticipants,
          durationMinutes: autoConfig.durationMinutes,
          assignedUsers: [] as string[],
        }),
      );

      if (isAutoAssign) {
        shuffled.forEach((p, i) => {
          const roomIndex = Math.floor(i / autoConfig.maxParticipants);
          if (roomIndex < autoConfig.roomCount) {
            finalRoomsPayload[roomIndex].assignedUsers?.push(p.identity);
          }
        });
      }
    } else if (activeTab === "manual") {
      if (manualRooms.some((r) => r.name.trim() === ""))
        return toast.error("Tên phòng không được để trống");
      finalRoomsPayload = manualRooms.map((room) => ({
        name: room.name,
        maxParticipants: 2,
        durationMinutes: room.durationMinutes,
        assignedUsers: Object.entries(manualAssignments)
          .filter(([_, rId]) => rId === room.id)
          .map(([uId]) => uId),
      }));
    } else if (activeTab === "self") {
      if (selfRooms.some((r) => r.name.trim() === ""))
        return toast.error("Tên phòng không được để trống");
      if (selfRooms.some((r) => r.maxParticipants < 2))
        return toast.error("Cần từ 2 người trở lên");
      if (selfRooms.some((r) => r.durationMinutes < 1))
        return toast.error("Tối thiểu 1 phút");
      finalRoomsPayload = selfRooms;
    }

    try {
      await startBreakoutApi({
        code: meetingCode,
        rooms: finalRoomsPayload,
      }).unwrap();

      toast.success("Đã mở các phòng thảo luận nhóm!");
      onClose();
    } catch (error: any) {
      if (error?.status === 400) toast.error("Dữ liệu không hợp lệ.");
      else toast.error("Lỗi khi tạo phòng thảo luận.");
    }
  };

  const unassignedParticipants = participants.filter(
    (p) => !manualAssignments[p.identity],
  );

  return (
    <>
      <div
        className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm animate-fade-in transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-101 w-[95vw] md:w-[85vw] max-w-4xl bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in fade-in zoom-in duration-200 h-[85vh] md:h-[75vh]">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#333] flex items-center justify-between bg-[#111] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#222] rounded-lg border border-[#333]">
              <Network className="text-blue-400" size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              Chia nhóm thảo luận
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center gap-2 px-5 pt-4 bg-[#111] border-b border-[#333] shrink-0">
          <button
            onClick={() => setActiveTab("auto")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === "auto"
                ? "border-blue-500 text-blue-400 bg-[#222]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wand2 size={16} /> Tự động
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === "manual"
                ? "border-blue-500 text-blue-400 bg-[#222]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Hand size={16} /> Thủ công
          </button>
          <button
            onClick={() => setActiveTab("self")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === "self"
                ? "border-blue-500 text-blue-400 bg-[#222]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings size={16} /> Tự chọn
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-hidden bg-[#161616]">
          {/* TAB 1: TỰ ĐỘNG */}
          {activeTab === "auto" && (
            <div className="p-6 h-full flex flex-col items-center overflow-y-auto custom-scrollbar">
              <div className="text-center space-y-2 mb-6 max-w-md">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 mb-2">
                  <Users className="text-blue-400" size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-100">
                  Chia nhóm tự động
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Hệ thống sẽ tạo phòng và ngẫu nhiên phân bổ người tham gia.
                  Mỗi phòng sẽ có tối thiểu{" "}
                  <strong className="text-white">2 người</strong>. Hiện đang có{" "}
                  <strong className="text-white">{participants.length}</strong>{" "}
                  người tham gia.
                </p>
              </div>

              <div className="w-full max-w-sm space-y-5 bg-[#222] p-5 rounded-xl border border-[#333]">
                {/* Checkbox thêm người */}
                <label className="flex items-start gap-3 cursor-pointer p-3 bg-[#111] border border-[#444] rounded-lg hover:border-blue-500 transition-colors group">
                  <div className="flex items-center h-5 mt-0.5">
                    <input
                      type="checkbox"
                      checked={isAutoAssign}
                      onChange={(e) => setIsAutoAssign(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-[#222] border-[#555] rounded focus:ring-blue-500 focus:ring-offset-[#111]"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                      Tự động thêm thành viên vào phòng
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      Người tham gia sẽ được hệ thống chuyển hướng vào các phòng
                      thảo luận.
                    </span>
                  </div>
                </label>

                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                    Số người tối đa / phòng
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={autoConfig.maxParticipants}
                    onChange={(e) =>
                      setAutoConfig({
                        ...autoConfig,
                        maxParticipants: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#111] border border-[#444] text-white text-base font-mono rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                    Số lượng phòng
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={autoConfig.roomCount}
                    onChange={(e) =>
                      setAutoConfig({
                        ...autoConfig,
                        roomCount: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#111] border border-[#444] text-white text-base font-mono rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-2 text-right italic">
                    Gợi ý: Cần tối thiểu{" "}
                    {Math.ceil(
                      participants.length /
                        Math.max(1, autoConfig.maxParticipants),
                    )}{" "}
                    phòng cho {participants.length} người.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                    Thời gian (Phút)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={autoConfig.durationMinutes}
                    onChange={(e) =>
                      setAutoConfig({
                        ...autoConfig,
                        durationMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#111] border border-[#444] text-white text-base font-mono rounded-lg px-3 py-2.5 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THỦ CÔNG */}
          {activeTab === "manual" && (
            <div className="flex flex-col h-full w-full">
              <div className="px-5 py-3 border-b border-[#333] bg-[#1a1a1a]">
                <p className="text-slate-400 text-sm">
                  Phân bổ người tham gia vào các nhóm cụ thể bằng cách{" "}
                  <strong className="text-white">kéo và thả</strong> tên người
                  dùng.
                </p>
              </div>
              <div className="flex flex-1 overflow-hidden w-full">
                {/* Cột trái */}
                <div
                  className={`w-1/3 border-r border-[#333] flex flex-col transition-colors ${draggedOverRoom === null && draggedUserId ? "bg-[#222]/50" : "bg-[#1a1a1a]"}`}
                  onDragOver={(e) => handleDragOver(e, null)}
                  onDrop={(e) => handleDrop(e, null)}
                >
                  <div className="p-3 border-b border-[#333] bg-[#111]">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Danh sách chờ ({unassignedParticipants.length})
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {unassignedParticipants.map((p) => (
                      <div
                        key={p.identity}
                        draggable
                        onDragStart={(e) => handleDragStart(e, p.identity)}
                        className="p-2.5 bg-[#222] border border-[#444] rounded-lg cursor-grab active:cursor-grabbing hover:border-slate-400 hover:bg-[#2a2a2a] transition-all flex items-center gap-2 shadow-sm"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 text-white">
                          {p.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {p.name}
                        </span>
                      </div>
                    ))}
                    {unassignedParticipants.length === 0 && (
                      <div className="text-center text-slate-500 text-xs mt-10 italic">
                        Đã phân công tất cả
                      </div>
                    )}
                  </div>
                </div>

                {/* Cột phải */}
                <div className="flex-1 bg-[#161616] flex flex-col">
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {manualRooms.map((room, idx) => {
                        const roomUsers = participants.filter(
                          (p) => manualAssignments[p.identity] === room.id,
                        );
                        const isDragOver = draggedOverRoom === room.id;

                        return (
                          <div
                            key={room.id}
                            onDragOver={(e) => handleDragOver(e, room.id)}
                            onDrop={(e) => handleDrop(e, room.id)}
                            className={`flex flex-col bg-[#222] rounded-xl transition-all duration-200 overflow-hidden border-2 ${
                              isDragOver
                                ? "border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10 scale-[1.02]"
                                : "border-[#333]"
                            }`}
                          >
                            {/* Tiêu đề phòng thủ công đã được fix UI */}
                            <div className="p-3 border-b border-[#333] bg-[#1a1a1a] flex gap-2 items-center justify-between">
                              <input
                                type="text"
                                value={room.name}
                                onChange={(e) => {
                                  const newRooms = [...manualRooms];
                                  newRooms[idx].name = e.target.value;
                                  setManualRooms(newRooms);
                                }}
                                className="flex-1 bg-transparent border-none text-sm font-bold text-white outline-none min-w-0"
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Input thời lượng */}
                                <div className="flex items-center gap-1.5 bg-[#111] rounded-md px-2 py-1 border border-[#333]">
                                  <Clock size={12} className="text-slate-500" />
                                  <input
                                    type="number"
                                    min={1}
                                    value={room.durationMinutes}
                                    onChange={(e) => {
                                      const newRooms = [...manualRooms];
                                      newRooms[idx].durationMinutes = Number(
                                        e.target.value,
                                      );
                                      setManualRooms(newRooms);
                                    }}
                                    className="w-10 bg-transparent border-none text-xs text-center font-mono text-amber-400 outline-none"
                                  />
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    phút
                                  </span>
                                </div>
                                {/* Nút xoá phòng */}
                                <button
                                  onClick={() => {
                                    // Xoá phòng khỏi danh sách
                                    setManualRooms(
                                      manualRooms.filter(
                                        (r) => r.id !== room.id,
                                      ),
                                    );
                                    // Trả các thành viên thuộc phòng này về danh sách chờ
                                    setManualAssignments((prev) => {
                                      const next = { ...prev };
                                      Object.keys(next).forEach((userId) => {
                                        if (next[userId] === room.id) {
                                          delete next[userId];
                                        }
                                      });
                                      return next;
                                    });
                                  }}
                                  className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                                  title="Xoá phòng này"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Khối chứa người */}
                            <div className="p-3 min-h-25 max-h-50 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                              {roomUsers.length === 0 ? (
                                <div className="m-auto text-slate-500 text-xs italic">
                                  Kéo thả người dùng vào đây
                                </div>
                              ) : (
                                roomUsers.map((p) => (
                                  <div
                                    key={p.identity}
                                    draggable
                                    onDragStart={(e) =>
                                      handleDragStart(e, p.identity)
                                    }
                                    className="px-2.5 py-1.5 bg-[#111] border border-[#333] rounded-md text-xs font-medium text-slate-200 flex items-center gap-2 cursor-grab active:cursor-grabbing hover:border-slate-500 transition-colors shadow-sm"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[9px] font-bold text-white">
                                      {p.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{p.name}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <button
                        onClick={() =>
                          setManualRooms([
                            ...manualRooms,
                            {
                              id: `room-${Date.now()}`,
                              name: `Nhóm ${manualRooms.length + 1}`,
                              durationMinutes: 10,
                            },
                          ])
                        }
                        className="min-h-35 border-2 border-dashed border-[#444] hover:border-blue-500 hover:bg-blue-500/5 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-400 transition-colors gap-2"
                      >
                        <Plus size={20} />
                        <span className="text-sm font-semibold">
                          Thêm nhóm mới
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TỰ CHỌN */}
          {activeTab === "self" && (
            <div className="flex flex-col h-full w-full">
              <div className="px-5 py-3 border-b border-[#333] bg-[#1a1a1a]">
                <p className="text-slate-400 text-sm">
                  Tạo các phòng trống. Người tham gia có thể tự do{" "}
                  <strong className="text-white">lựa chọn phòng</strong> muốn
                  vào.
                </p>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                {selfRooms.map((room, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-[#222] border border-[#333] rounded-xl relative group"
                  >
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
                          Tên phòng
                        </label>
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => {
                            const newR = [...selfRooms];
                            newR[index].name = e.target.value;
                            setSelfRooms(newR);
                          }}
                          className="w-full bg-[#111] border border-[#444] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                            Số người tối đa
                          </label>
                          <input
                            type="number"
                            min={2}
                            value={room.maxParticipants}
                            onChange={(e) => {
                              const newR = [...selfRooms];
                              newR[index].maxParticipants = Number(
                                e.target.value,
                              );
                              setSelfRooms(newR);
                            }}
                            className="w-full bg-[#111] border border-[#444] text-white text-sm font-mono rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                            Thời gian (phút)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={room.durationMinutes}
                            onChange={(e) => {
                              const newR = [...selfRooms];
                              newR[index].durationMinutes = Number(
                                e.target.value,
                              );
                              setSelfRooms(newR);
                            }}
                            className="w-full bg-[#111] border border-[#444] text-white text-sm font-mono rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (selfRooms.length <= 1)
                          return toast.error("Cần ít nhất 1 phòng");
                        setSelfRooms(selfRooms.filter((_, i) => i !== index));
                      }}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSelfRooms([
                      ...selfRooms,
                      {
                        name: `Nhóm ${selfRooms.length + 1}`,
                        maxParticipants: 2,
                        durationMinutes: 10,
                      },
                    ])
                  }
                  className="w-full py-3 border-2 border-dashed border-[#444] hover:border-blue-500 hover:bg-blue-500/5 rounded-xl flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-400 font-semibold transition-colors mt-2"
                >
                  <Plus size={18} /> Thêm phòng mới
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-[#333] bg-[#1a1a1a] flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-gray-300 hover:bg-[#333] rounded-lg transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            Bắt đầu phân chia
          </button>
        </div>
      </div>
    </>
  );
}
