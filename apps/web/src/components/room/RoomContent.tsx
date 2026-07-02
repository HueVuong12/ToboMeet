"use client";

import { useEffect, useRef, useState } from "react";
import {
  useGetRoomByIdQuery,
  useGetRoomMembersQuery,
  useJoinMeetingMutation,
} from "@/lib/redux/api/roomsApi";
import Sidebar from "./Sidebar";
import {
  Loader2,
  Users,
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
  Mic,
  VideoOff,
  MicOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

interface RoomContentProps {
  roomId: string;
  userId: string;
}

export default function RoomContent({ roomId, userId }: RoomContentProps) {
  const t = useTranslations("room");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>("General"); // Quản lý kênh đang chọn
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [isJoining, setIsJoining] = useState(false);
  const [joinMeetingApi] = useJoinMeetingMutation();

  // [MỚI] State cho Preview Modal
  const [previewDisplayName, setPreviewDisplayName] = useState("");
  const [isPreviewCamOn, setIsPreviewCamOn] = useState(true);
  const [isPreviewMicOn, setIsPreviewMicOn] = useState(false);

  // Ref để gắn luồng video vào thẻ <video>
  const videoRef = useRef<HTMLVideoElement>(null);

  // [MỚI] Effect xử lý bật/tắt thiết bị cho Preview
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const startMedia = async () => {
      if (!showPreviewModal) return;
      try {
        // Xin quyền truy cập thiết bị
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: isPreviewCamOn,
          audio: isPreviewMicOn,
        });

        // Gắn luồng (stream) vào thẻ video
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
        }
      } catch (err) {
        console.error("Không thể truy cập thiết bị:", err);
      }
    };

    if (showPreviewModal && (isPreviewCamOn || isPreviewMicOn)) {
      startMedia();
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Cleanup: Tắt camera/mic khi đóng modal hoặc component unmount
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showPreviewModal, isPreviewCamOn, isPreviewMicOn]);

  if (roomLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <p className="text-slate-500 text-sm">{t("room_not_found")}</p>
      </div>
    );
  }

  const handleJoinMeeting = async () => {
    const currentChannel = room?.channels.find((c) => c.name === activeChannel);
    if (!currentChannel?._id) return;

    try {
      setIsJoining(true);
      // [Cập nhật] Gửi thêm displayName qua BE
      const response = await joinMeetingApi({
        roomId,
        channelId: currentChannel._id,
        displayName: previewDisplayName || undefined,
      }).unwrap();

      setShowPreviewModal(false);
      const meetingUrl = `/meeting?token=${encodeURIComponent(response.token)}&roomId=${encodeURIComponent(roomId)}&channelName=${encodeURIComponent(activeChannel)}&cam=${isPreviewCamOn}&mic=${isPreviewMicOn}`;
      window.open(meetingUrl, "_blank");
    } catch (error) {
      console.error("Lỗi khi join meeting:", error);
      alert("Không thể tham gia cuộc họp lúc này.");
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
            {/* Nút Cuộc họp */}
            <div className="relative">
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

      {showPreviewModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Chuẩn bị tham gia
                </h2>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Khu vực Video Preview */}
              <div className="aspect-video bg-slate-900 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative border border-slate-200">
                {isPreviewCamOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted // Luôn muted để không bị vọng âm thanh của chính mình
                    className="w-full h-full object-cover transform -scale-x-100" // scale-x-100 để lật gương (mirror) camera
                  />
                ) : (
                  <div className="text-slate-500 flex flex-col items-center">
                    <VideoOff size={32} className="mb-2 opacity-50" />
                    <span>Camera đang tắt</span>
                  </div>
                )}

                {/* Chỉ báo trạng thái Mic trên khung video */}
                {!isPreviewMicOn && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white p-1.5 rounded-md shadow-sm">
                    <MicOff size={14} />
                  </div>
                )}
              </div>

              {/* Control Test Cam/Mic */}
              <div className="flex gap-4 justify-center mb-6">
                <button
                  onClick={() => setIsPreviewMicOn(!isPreviewMicOn)}
                  className={`p-3.5 rounded-full transition-colors ${
                    isPreviewMicOn
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      : "bg-red-100 hover:bg-red-200 text-red-600"
                  }`}
                >
                  {isPreviewMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  onClick={() => setIsPreviewCamOn(!isPreviewCamOn)}
                  className={`p-3.5 rounded-full transition-colors ${
                    isPreviewCamOn
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      : "bg-red-100 hover:bg-red-200 text-red-600"
                  }`}
                >
                  {isPreviewCamOn ? (
                    <Video size={20} />
                  ) : (
                    <VideoOff size={20} />
                  )}
                </button>
              </div>

              {/* [MỚI] Ô nhập tên hiển thị */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tên hiển thị trong cuộc họp
                </label>
                <input
                  type="text"
                  value={previewDisplayName}
                  onChange={(e) => setPreviewDisplayName(e.target.value)}
                  placeholder="Nhập tên của bạn (tùy chọn)"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                />
              </div>

              <button
                onClick={handleJoinMeeting}
                disabled={isJoining}
                className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                {isJoining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Tham gia ngay"
                )}
              </button>
            </div>
          </div>,
          document.body,
        )}

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
          <h2 className="text-sm font-bold text-slate-800">Trong kênh này</h2>
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
                Mọi người ({members.length})
              </h3>
              <button className="text-xs font-medium text-brand-600 hover:underline">
                Xem tất cả
              </button>
            </div>

            {membersLoading ? (
              <div className="text-center text-slate-400 py-4 text-sm">
                Đang tải...
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-slate-400 py-4 text-sm">
                Trống.
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
                            (Bạn)
                          </span>
                        )}
                      </p>
                      <div className="flex items-center">
                        {member.role === "owner" ? (
                          <div className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1 py-0 rounded text-[9px] font-bold uppercase tracking-wide w-max">
                            <Crown size={9} />
                            <span>Chủ phòng</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500">
                            Thành viên
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
                              Xem hồ sơ
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
                                  Xóa khỏi phòng
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
            <p className="mb-2 font-semibold">Mô tả phòng</p>
            <p>Không gian làm việc chung dành cho phòng {room.name}.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
