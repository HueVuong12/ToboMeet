"use client";

import { useEffect, useRef, useState } from "react";
import {
  roomsApi,
  useGetActiveMeetingQuery,
  useGetRoomByIdQuery,
  useGetRoomMembersQuery,
  useJoinMeetingMutation,
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
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/lib/redux/store";
import PreviewModal from "./PreviewModal";
import { toast } from "sonner";

interface RoomContentProps {
  roomId: string;
  userId: string;
}

export default function RoomContent({ roomId, userId }: RoomContentProps) {
  const t = useTranslations("room");
  const dispatch = useDispatch<AppDispatch>();

  // API Fetch
  const {
    data: room,
    isLoading: roomLoading,
    error: roomError,
  } = useGetRoomByIdQuery(roomId);
  const { data: membersResponse, isLoading: membersLoading } =
    useGetRoomMembersQuery(roomId);
  const members = membersResponse || [];

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

  // Quản lý cửa sổ popup phòng họp
  const meetingWindowRef = useRef<Window | null>(null);

  // Lưu tạm cấu hình thiết bị khi user bấm "Chuyển" để lúc Máy A đồng ý thì Máy B tự động join
  const pendingJoinConfigRef = useRef<any>(null);

  // State xác định xem thiết bị này có đang là thiết bị "đang họp" không
  const [isJoinedOnThisDevice, setIsJoinedOnThisDevice] = useState(false);

  // Socket.io: Join/Leave channel và lắng nghe sự kiện thay đổi trạng thái cuộc họp
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

  // LẮNG NGHE ĐỒNG Ý CHUYỂN THIẾT BỊ VÀ ĐÓNG POPUP
  useEffect(() => {
    // Máy B Lắng nghe: Khi Máy A bấm "Cho phép" ở Toast Toàn cục
    const handleSwitchAccepted = (data: any) => {
      if (
        data.channelId === currentChannel?._id &&
        pendingJoinConfigRef.current
      ) {
        toast.success("Đã kết nối thiết bị mới, đang vào phòng...");
        handleJoinMeeting(pendingJoinConfigRef.current, true); // forceSwitch = true

        pendingJoinConfigRef.current = null;
      }
    };
    socket.on("switch_device_accepted", handleSwitchAccepted);

    // Máy A Lắng nghe: Khi EventProvider yêu cầu đóng cửa sổ (Bằng Custom DOM Event)
    const handleForceClose = (e: any) => {
      if (e.detail === roomId) {
        if (meetingWindowRef.current && !meetingWindowRef.current.closed) {
          meetingWindowRef.current.close(); // Tự động đóng popup
        }
        setIsJoinedOnThisDevice(false);
      }
    };
    window.addEventListener("FORCE_CLOSE_MEETING_WINDOW", handleForceClose);

    return () => {
      socket.off("switch_device_accepted", handleSwitchAccepted);
      window.removeEventListener(
        "FORCE_CLOSE_MEETING_WINDOW",
        handleForceClose,
      );
    };
  }, [currentChannel?._id, roomId]);

  const [isJoining, setIsJoining] = useState(false);
  const [joinMeetingApi] = useJoinMeetingMutation();

  if (roomLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (roomError) {
    const errData = roomError as any;
    if (
      errData.code === 403 ||
      errData.status === 403 ||
      errData.message?.includes("khóa") ||
      errData.message?.includes("locked")
    ) {
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

  const handleJoinMeeting = async (
    config: {
      displayName: string;
      isCamOn: boolean;
      isMicOn: boolean;
      cameraId: string;
      micId: string;
      speakerId: string;
      resolution: { width: number; height: number };
    },
    forceSwitch = false,
  ) => {
    if (!currentChannel?._id) return;

    try {
      setIsJoining(true);
      const response = await joinMeetingApi({
        roomId,
        channelId: currentChannel._id,
        displayName: config.displayName || undefined,
        forceSwitch,
      }).unwrap();

      const cameraConfig = encodeURIComponent(
        JSON.stringify({
          deviceId: config.cameraId,
          width: config.resolution.width,
          height: config.resolution.height,
        }),
      );

      setShowPreviewModal(false);

      // Thêm micId + speakerId
      const meetingUrl = `/meeting?token=${encodeURIComponent(
        response.token,
      )}&roomId=${roomId}&channelId=${currentChannel._id}&channelName=${encodeURIComponent(
        activeChannel,
      )}&meetingCode=${response.meetingCode}&cam=${config.isCamOn}&cameraConfig=${cameraConfig}&mic=${config.isMicOn}&micId=${config.micId}&speakerId=${config.speakerId}`;

      // Đánh dấu thiết bị này là thiết bị đang trong cuộc họp
      localStorage.setItem(`active_meeting_${roomId}`, currentChannel._id);
      setIsJoinedOnThisDevice(true);

      setTimeout(() => {
        // Lưu lại Ref của cửa sổ để đóng sau này
        meetingWindowRef.current = window.open(meetingUrl, "_blank");

        // Lắng nghe xem khi nào cửa sổ này bị tắt thì reset trạng thái
        const timer = setInterval(() => {
          if (meetingWindowRef.current?.closed) {
            clearInterval(timer);
            localStorage.removeItem(`active_meeting_${roomId}`);
            setIsJoinedOnThisDevice(false);
          }
        }, 1000);
      }, 800);
    } catch (error: any) {
      // Code 4013: Đang có thiết bị khác trong cuộc họp
      if (error?.code === 4013) {
        setShowPreviewModal(false);
        pendingJoinConfigRef.current = config; // Lưu cấu hình chờ duyệt

        toast.error("Bạn đang ở trong phòng này trên thiết bị/tab khác.", {
          duration: 10000,
          action: {
            label: "Chuyển sang máy này",
            onClick: () => {
              socket.emit("request_switch_device", {
                userId,
                channelId: currentChannel._id,
                roomId: roomId,
                requesterSocketId: socket.id,
              });
              toast.info("Đang chờ xác nhận từ thiết bị khác...");
            },
          },
        });
      } else {
        toast.error("Không thể tham gia cuộc họp lúc này.");
      }
    } finally {
      setIsJoining(false);
    }
  };

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
                    <span>Đang họp trên thiết bị này</span>
                  </button>
                ) : (
                  // TRẠNG THÁI 2: ĐANG HỌP Ở MÁY KHÁC (HOẶC CHƯA VÀO) -> Nút Chuyển thiết bị
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition-colors shadow-sm shadow-amber-500/20"
                  >
                    <Video size={16} />
                    <span>Tham gia / Chuyển thiết bị</span>
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
                                    // handleRemoveMember(member.userId);
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
    </div>
  );
}
