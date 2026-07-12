"use client";

import { useEffect, useState } from "react";
import {
  roomsApi,
  useGetActiveMeetingQuery,
  useGetRoomByIdQuery,
  useGetRoomMembersQuery,
  useRemoveMemberMutation,
} from "@/lib/redux/api/roomsApi";
import Sidebar from "./Sidebar";
import {
  Loader2,
  Menu,
  X,
  Info,
  Send,
  Paperclip,
  Smile,
  Crown,
  MoreVertical,
  Video,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/lib/redux/store";
import PreviewModal from "./PreviewModal";
import { useMeetingManager } from "@/hooks/useMeetingManager";

interface RoomContentProps {
  roomId: string;
  userId: string;
}

export default function RoomContent({ roomId, userId }: RoomContentProps) {
  const t = useTranslations("room");
  const dispatch = useDispatch<AppDispatch>();

  const {
    data: room,
    isLoading: roomLoading,
    error: roomError,
  } = useGetRoomByIdQuery(roomId);
  const { data: membersResponse, isLoading: membersLoading } =
    useGetRoomMembersQuery(roomId);
  const members = membersResponse || [];

  const [removeMember] = useRemoveMemberMutation();

  // Trạng thái Layout & Dữ liệu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>("General"); // Quản lý kênh đang chọn
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Tìm thông tin chi tiết của kênh đang được active
  const currentChannel = room?.channels.find(
    (c: any) => c.name === activeChannel,
  );

  const { data: activeMeeting } = useGetActiveMeetingQuery(
    { roomId, channelId: currentChannel?._id || "" },
    { skip: !currentChannel?._id },
  );

  const { handleJoinMeeting, isJoining, isJoinedOnThisDevice } =
    useMeetingManager({
      roomId,
      userId,
      currentChannel,
      activeChannel,
      setShowPreviewModal,
    });

  // Join/Leave channel và lắng nghe sự kiện thay đổi trạng thái cuộc họp
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const channelId = currentChannel?._id;
    if (!channelId) return;

    const joinChannel = () => {
      socket.emit("join_channel", channelId);
    };

    if (socket.connected) joinChannel();
    socket.on("connect", joinChannel); // Fix lỗi mất trạng thái khi Server Restart

    const handleStatusChanged = (data: any) => {
      dispatch(
        roomsApi.util.updateQueryData(
          "getActiveMeeting",
          { roomId, channelId },
          (draft) => {
            draft.isOngoing = data.isOngoing;
            draft.meetingCode = data.meetingCode;
          },
        ),
      );
    };

    socket.on("meeting_status_changed", handleStatusChanged);

    return () => {
      socket.emit("leave_channel", channelId);
      socket.off("connect", joinChannel);
      socket.off("meeting_status_changed", handleStatusChanged);
    };
  }, [currentChannel?._id, dispatch]); // Chạy lại mỗi khi đổi kênh

  // Lắng nghe sự kiện bị xóa khỏi phòng realtime
  useEffect(() => {
    if (!roomId || !userId) return;

    if (!socket.connected) {
      socket.connect();
    }

    const joinRoomSocket = () => {
      socket.emit("join_room", roomId);
    };

    if (socket.connected) joinRoomSocket();
    socket.on("connect", joinRoomSocket);

    const handleRoomUpdated = (data: any) => {
      if (data.type === "member_removed" && data.removedUserId === userId) {
        toast.error("Bạn đã bị Chủ phòng xóa khỏi phòng.");
        localStorage.removeItem(`active_meeting_${roomId}`);
        window.dispatchEvent(
          new CustomEvent("FORCE_CLOSE_MEETING_WINDOW", {
            detail: roomId,
          }),
        );
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      }
    };

    socket.on("room_updated", handleRoomUpdated);

    return () => {
      socket.emit("leave_room", roomId);
      socket.off("connect", joinRoomSocket);
      socket.off("room_updated", handleRoomUpdated);
    };
  }, [roomId, userId]);

  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; displayName: string } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setIsRemovingMember(true);
      await removeMember({ roomId, userId: memberToRemove.userId }).unwrap();
      toast.success(t("remove_member_success"));
      setMemberToRemove(null);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("remove_member_error"));
    } finally {
      setIsRemovingMember(false);
    }
  };

  if (roomLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (roomError) {
    const errData = roomError as any;
    const isLocked = errData.message?.includes("khóa") || errData.message?.includes("locked");
    if (errData.status === 403 && !isLocked) {
      const msg = errData.data?.message || errData.message || "Bạn không còn là thành viên của phòng này";
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-white gap-3">
          <p className="text-slate-600 font-bold text-base">{msg}</p>
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Quay lại Trang chủ
          </button>
        </div>
      );
    }
    if (isLocked) {
      return (
        <div className="h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        </div>
      );
    }
  }

  if (roomError || !room) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <p className="text-slate-500 text-sm">{t("room_not_found")}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-white font-sans overflow-hidden text-slate-900">
      {/* ================= LEFT SIDEBAR (KÊNH) ================= */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 flex-shrink-0 transition-transform duration-300 ease-in-out
          ${isLeftSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0
        `}
      >
        <Sidebar
          room={room}
          userId={userId}
          activeChannel={activeChannel}
          setActiveChannel={setActiveChannel}
          onClose={() => setIsLeftSidebarOpen(false)}
        />
      </div>

      {/* Lớp phủ đen cho Left Sidebar trên Mobile */}
      {isLeftSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsLeftSidebarOpen(false)}
        />
      )}

      {/* ================= MAIN CONTENT (BẢNG TIN / POSTS) ================= */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
        {/* Header Kênh (Giống Teams) */}
        <header className="h-14 px-4 border-b border-slate-200 bg-white flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-1.5 -ml-1.5 hover:bg-slate-100 rounded-md text-slate-600"
              onClick={() => setIsLeftSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-100 text-brand-600 rounded flex items-center justify-center font-bold text-sm">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <h1 className="text-lg font-bold text-slate-800">
                {activeChannel}
              </h1>
            </div>

            {/* Tabs (Giả lập giao diện) */}
            <div className="hidden sm:flex items-center gap-1 ml-4 text-sm font-medium">
              <button className="px-3 py-4 border-b-2 border-brand-500 text-brand-600">
                Bài viết
              </button>
              <button className="px-3 py-4 border-b-2 border-transparent text-slate-500 hover:text-slate-700">
                Lịch sử cuộc họp
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Cuộc họp / Tham gia */}
            <div className="relative">
              {activeMeeting?.isOngoing ? (
                isJoinedOnThisDevice ? (
                  // TRẠNG THÁI 1: ĐANG HỌP TRÊN CHÍNH MÁY NÀY
                  <button className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-md text-sm font-medium border border-emerald-300 cursor-default">
                    <Video size={16} />
                    <span>Đang họp</span>
                  </button>
                ) : (
                  // TRẠNG THÁI 2: ĐANG HỌP Ở MÁY KHÁC (HOẶC CHƯA VÀO) -> Nút Chuyển thiết bị
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition-colors shadow-sm shadow-amber-500/20"
                  >
                    <Video size={16} />
                    <span>Tham gia</span>
                  </button>
                )
              ) : (
                // TRẠNG THÁI 3: KHÔNG CÓ CUỘC HỌP -> Hiện menu tạo mới như cũ
                <>
                  <button
                    onClick={() => setIsMeetingMenuOpen(!isMeetingMenuOpen)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    <Video size={16} />
                    <span>Cuộc họp</span>
                    <ChevronDown size={14} />
                  </button>

                  {isMeetingMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMeetingMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-12 z-50 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                        <button
                          onClick={() => {
                            setIsMeetingMenuOpen(false);
                            setShowPreviewModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Video size={16} /> Bắt đầu họp ngay
                        </button>
                        <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <Calendar size={16} /> Lên lịch cuộc họp
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className={`p-2 rounded-md transition-colors flex items-center gap-2 text-sm font-medium ${
                isRightSidebarOpen
                  ? "bg-brand-50 text-brand-600"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              <Info size={18} />
            </button>
          </div>
        </header>

        {/* Nội dung Chat / Post Feed */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 flex flex-col gap-6">
          {/* Placeholder Message (Giao diện giống hình ảnh cung cấp) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Hệ thống</p>
                  <p className="text-xs text-slate-500">Vừa xong</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              Chào mừng bạn đến với kênh{" "}
              <span className="font-semibold">{activeChannel}</span> của phòng
              họp {room.name}. Hãy bắt đầu thảo luận!
            </p>
          </div>
        </main>

        {/* Khu vực Nhập tin nhắn (Chat input) */}
        <div className="p-4 bg-slate-50">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm flex flex-col">
            <input
              type="text"
              placeholder="Bắt đầu bài viết mới..."
              className="w-full px-4 py-3 text-sm text-slate-800 bg-transparent focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50 rounded-b-lg">
              <div className="flex gap-1 text-slate-500">
                <button className="p-1.5 hover:bg-slate-200 rounded">
                  <Paperclip size={18} />
                </button>
                <button className="p-1.5 hover:bg-slate-200 rounded">
                  <Smile size={18} />
                </button>
              </div>
              <button className="bg-brand-600 hover:bg-brand-700 text-white p-1.5 rounded-md transition-colors">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDEBAR (THÔNG TIN KÊNH / THÀNH VIÊN) ================= */}
      {/* Mobile: Trượt đè | Desktop: Đẩy layout */}
      {isRightSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setIsRightSidebarOpen(false)}
        />
      )}

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onJoin={handleJoinMeeting}
        isJoining={isJoining}
      />

      <aside
        className={`
          fixed inset-y-0 right-0 z-40 flex flex-col bg-white border-l border-slate-200 shadow-xl lg:shadow-none
          transition-all duration-300 ease-in-out
          
          /* Mobile */
          w-[300px] ${isRightSidebarOpen ? "translate-x-0" : "translate-x-full"}
          
          /* Desktop */
          lg:relative lg:translate-x-0
          ${isRightSidebarOpen ? "lg:w-[300px] lg:opacity-100" : "lg:w-0 lg:opacity-0 lg:border-none"}
          overflow-hidden flex-shrink-0
        `}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200 min-w-[300px]">
          <h2 className="text-sm font-bold text-slate-800">
            {t("in_this_channel")}
          </h2>
          <button
            onClick={() => setIsRightSidebarOpen(false)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-w-[300px]">
          {/* People Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase">
                {t("people")} ({members.length})
              </h3>
              <button className="text-xs font-medium text-brand-600 hover:underline">
                {t("view_all")}
              </button>
            </div>

            {membersLoading ? (
              <div className="text-center text-slate-400 py-4 text-sm">
                {t("loading_title")}
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-slate-400 py-4 text-sm">
                {t("empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member: any) => (
                  <div
                    key={member.userId}
                    className="group relative flex items-center gap-3 hover:bg-slate-50 p-2 rounded-lg transition-colors cursor-pointer"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs uppercase">
                          {member.displayName?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>

                    {/* Thông tin Text: Dùng flex-1 và truncate để không phá vỡ layout */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {member.displayName}
                        {member.userId === userId && (
                          <span className="text-slate-400 font-normal ml-1">
                            ({t("you")})
                          </span>
                        )}
                      </p>
                      <div className="flex items-center">
                        {member.role === "owner" ? (
                          <div className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1 py-0 rounded text-[9px] font-bold uppercase tracking-wide w-max">
                            <Crown size={9} />
                            <span>{t("room_owner")}</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500">
                            {t("anonymous_user")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* DẤU 3 CHẤM: Đặt NẰM NGOÀI div flex-col để không bị ảnh hưởng bởi overflow */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === member.userId ? null : member.userId,
                          );
                        }}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* DROPDOWN MENU */}
                      {openMenuId === member.userId && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-4 z-50 w-40 bg-white border border-slate-200 rounded-lg shadow-xl py-1 mt-1">
                            <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              {t("view_profile")}
                            </button>
                             {userId !== member.userId &&
                              members.find((m) => m.userId === userId)?.role ===
                                "owner" && (
                                <button
                                  onClick={() => {
                                    setMemberToRemove({ userId: member.userId, displayName: member.displayName || "Người dùng" });
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  {t("remove_from_room")}
                                </button>
                              )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-100 my-4" />

          <div className="text-xs text-slate-500">
            <p className="mb-2 font-semibold">{t("room_description_title")}</p>
            <p>{t("room_description", { name: room.name })}</p>
          </div>
        </div>
      </aside>

      {/* Modal xác nhận xóa thành viên */}
      {memberToRemove && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 flex flex-col transform transition-all scale-100 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">{t("remove_member_title")}</h3>
              <button
                disabled={isRemovingMember}
                onClick={() => setMemberToRemove(null)}
                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                {t.rich("remove_member_confirm", {
                  name: memberToRemove.displayName,
                  strong: (chunks) => <strong className="text-slate-900 font-bold">{chunks}</strong>,
                })}
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 shrink-0">
              <button
                disabled={isRemovingMember}
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                {t("remove_member_cancel")}
              </button>
              <button
                disabled={isRemovingMember}
                onClick={handleRemoveMember}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl transition-colors min-w-[120px]"
              >
                {isRemovingMember ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t("remove_member_loading")}
                  </>
                ) : (
                  t("remove_member_action")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
