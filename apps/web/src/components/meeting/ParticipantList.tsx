import { useParticipantManager } from "@/hooks/useParticipantManager";
import {
  Crown,
  Edit2,
  Hand,
  Loader2,
  Mic,
  MicOff,
  MoreVertical,
  Shield,
  UserMinus,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * COMPONENT: Danh sách người tham gia
 */
export default function ParticipantList({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string | null;
  channelId: string | null;
  meetingCode: string | null;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const {
    localParticipant,
    displayParticipants,
    isLocalAdmin,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    getHandState,
  } = useParticipantManager({ roomId, channelId, meetingCode });

  return (
    <div className="flex flex-col h-full">
      {/* Hiển thị tổng số người */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Đang tham gia
        </span>
        <span className="text-xs font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded-full">
          {displayParticipants.length} người
        </span>
      </div>

      <div className="flex flex-col gap-1 w-full overflow-y-auto custom-scrollbar pb-32">
        {displayParticipants.map((p) => {
          let avatarUrl = "";
          let role = "member";
          const { isRaised } = getHandState(p);
          try {
            if (p.metadata) {
              const meta = JSON.parse(p.metadata);
              avatarUrl = meta.avatarUrl;
              role = meta.role || "member";
            }
          } catch (error) {}

          const isMe = p.identity === localParticipant.identity;

          return (
            <div
              key={p.identity}
              className="flex items-center gap-3 p-2.5 hover:bg-slate-700/30 rounded-xl transition-all group"
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={p.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-slate-700/50"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm uppercase border border-brand-500/30">
                    {p.name?.charAt(0) || "?"}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-800 rounded-full"></div>
              </div>

              {/* Thông tin */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-sm font-medium text-slate-200 truncate">
                  {p.name}
                  {isMe && (
                    <span className="text-slate-500 font-normal ml-1.5">
                      (Bạn)
                    </span>
                  )}
                </span>

                {role !== "member" && (
                  <div className="flex items-center mt-0.5">
                    {role === "owner" ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        <Crown size={12} /> Chủ phòng
                      </span>
                    ) : role === "admin" ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        <Shield size={12} /> Quản trị viên
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Cụm Action (Mic + Menu) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* ICON GIƠ TAY */}
                {isRaised && (
                  <Hand
                    size={14}
                    className="text-amber-400 mr-1 fill-amber-400 animate-pulse"
                  />
                )}
                {/* Trạng thái Mic */}
                <div className="text-slate-400">
                  {p.isMicrophoneEnabled ? (
                    <div className="p-1.5 bg-slate-800/50 rounded-lg">
                      <Mic size={14} className="text-emerald-400" />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-red-500/10 rounded-lg">
                      <MicOff size={14} className="text-red-400" />
                    </div>
                  )}
                </div>

                {/* 3 Chấm Menu hoặc Spinner */}
                <div className="relative">
                  {/* Kiểm tra nếu người này đang bị kick thì hiện vòng xoay, ngược lại hiện 3 chấm */}
                  {kickingUserId === p.identity ? (
                    <div className="p-1.5 text-red-400 flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === p.identity ? null : p.identity,
                        )
                      }
                      className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                  )}

                  {/* Dropdown Menu */}
                  {openMenuId === p.identity && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenMenuId(null)}
                      ></div>
                      <div className="absolute right-4 top-6 z-50 w-44 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl py-1.5 overflow-hidden backdrop-blur-xl">
                        {isMe && (
                          <button
                            onClick={() => {
                              setRenameState({
                                isOpen: true,
                                newName: p.name || "",
                              });
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2.5 transition-colors"
                          >
                            <Edit2 size={15} /> Đổi tên
                          </button>
                        )}

                        {/* CHỈ HIỆN KICK NẾU MÌNH LÀ ADMIN VÀ NGƯỜI BỊ KICK KHÔNG PHẢI LÀ MÌNH */}
                        {isLocalAdmin && !isMe && (
                          <>
                            <button
                              onClick={() => handleRemove(p.identity)}
                              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/15 hover:text-red-300 flex items-center gap-2.5 transition-colors"
                            >
                              <UserMinus size={15} /> Đuổi khỏi phòng
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Render Modal Đổi Tên bằng Portal để lơ lửng trên cùng */}
      {renameState?.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all">
              <h3 className="text-lg font-bold text-slate-100 mb-4 tracking-wide">
                Đổi tên hiển thị
              </h3>

              <input
                type="text"
                value={renameState.newName}
                onChange={(e) =>
                  setRenameState({ ...renameState, newName: e.target.value })
                }
                placeholder="Nhập tên mới..."
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 mb-6 transition-all"
                autoFocus // Tự động trỏ nháy chuột vào ô input
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()} // Nhấn Enter để lưu
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRenameState(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRenameSubmit}
                  disabled={!renameState.newName.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-lg shadow-brand-500/30 disabled:opacity-50 disabled:shadow-none"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
