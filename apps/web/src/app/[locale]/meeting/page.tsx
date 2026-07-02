"use client";

import { useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  useTracks,
  GridLayout,
  ParticipantTile,
  useLocalParticipant,
  TrackReference,
  TrackReferenceOrPlaceholder,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Hand,
  MessageSquare,
  MonitorUp,
  Users,
  X,
  Maximize2,
  Crown,
  Shield,
  MoreVertical,
  Edit2,
  UserMinus,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import "@livekit/components-styles";
import { useRemoveParticipantMutation } from "@/lib/redux/api/roomsApi";

export default function CustomMeetingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const channelName = searchParams.get("channelName");

  // Lấy các ID cần thiết để gọi API
  const roomId = searchParams.get("roomId");
  const channelId = searchParams.get("channelId");
  const meetingCode = searchParams.get("meetingCode");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "people">("chat");

  // Đọc trạng thái ban đầu của Cam và Mic (Mặc định là true nếu không có)
  const initialCam = searchParams.get("cam") !== "false";
  const initialMic = searchParams.get("mic") === "true";

  const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!token || !LIVEKIT_URL) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1f1f1f] text-white font-sans">
        Lỗi: Thiếu Token hoặc Server URL
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={initialCam}
      audio={initialMic}
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      onDisconnected={() => {
        window.close();
      }}
    >
      {/* Thay bg-#1f1f1f thành bg-slate-900 */}
      <div className="flex flex-col h-dvh w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans fixed inset-0">
        <header className="h-14 shrink-0 px-5 flex items-center justify-between bg-slate-900/50 backdrop-blur-md border-b border-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="text-sm font-semibold tracking-wide">
              {channelName || "Phòng họp"}
            </span>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative min-h-0 w-full p-2 md:p-3 gap-3">
          {/* LƯỚI VIDEO: Nền đen sâu, bo góc cực lớn (3xl) */}
          <div className="flex-1 flex flex-col h-full min-w-0">
            <div className="flex-1 bg-slate-950 rounded-3xl border border-slate-800/60 shadow-2xl relative overflow-hidden">
              <CustomVideoGrid />
            </div>
          </div>

          {/* SIDEBAR: Nền kính (glassmorphism), bo góc mềm */}
          {isSidebarOpen && (
            <aside
              className="
                z-20 flex flex-col shrink-0 
                bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl
                
                /* [CẬP NHẬT] CSS cho Mobile: Nổi bồng bềnh, cách đều các cạnh 8px (inset-2) */
                absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)]
                
                /* [CẬP NHẬT] CSS cho Desktop: Hủy absolute, trở lại bố cục Flexbox bình thường */
                sm:relative sm:inset-auto sm:w-80 sm:h-full
              "
            >
              <div className="h-14 px-5 flex items-center justify-between border-b border-slate-700/50 shrink-0">
                <h2 className="font-semibold text-sm text-slate-200 tracking-wide">
                  {sidebarTab === "chat" ? "Trò chuyện" : "Thành viên"}
                </h2>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {sidebarTab === "chat" ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    Chưa có tin nhắn nào.
                  </div>
                ) : (
                  <ParticipantList
                    roomId={roomId}
                    channelId={channelId}
                    meetingCode={meetingCode}
                  />
                )}
              </div>
            </aside>
          )}
        </main>

        {/* TOOLBAR: Nổi bật với viền mờ */}
        <div className="shrink-0 w-full z-30">
          <CustomToolbar
            onToggleSidebar={(tab) => {
              if (isSidebarOpen && sidebarTab === tab) setIsSidebarOpen(false);
              else {
                setSidebarTab(tab);
                setIsSidebarOpen(true);
              }
            }}
            activeTab={isSidebarOpen ? sidebarTab : null}
          />
        </div>
      </div>
    </LiveKitRoom>
  );
}

/**
 * COMPONENT: Lưới Video Thông Minh
 */
function CustomVideoGrid() {
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

/**
 * COMPONENT: Danh sách người tham gia
 */
function ParticipantList({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string | null;
  channelId: string | null;
  meetingCode: string | null;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [removeParticipant] = useRemoveParticipantMutation();

  // State lưu danh sách những người đã bị kick thành công để giấu đi ngay lập tức
  const [kickedUsers, setKickedUsers] = useState<string[]>([]);

  let localRole = "member";
  try {
    if (localParticipant.metadata) {
      localRole = JSON.parse(localParticipant.metadata).role || "member";
    }
  } catch (error) {}
  const isLocalAdmin = localRole === "owner" || localRole === "admin";

  const handleRemove = async (identity: string) => {
    const participant = participants.find((p) => p.identity === identity);
    if (!participant) return;

    if (
      !confirm(`Bạn có chắc chắn muốn đuổi ${participant.name} khỏi cuộc họp?`)
    )
      return;

    setOpenMenuId(null);
    setKickingUserId(identity);

    try {
      if (!roomId || !channelId || !meetingCode) {
        alert("Thiếu thông tin cần thiết để thực hiện thao tác!");
        return;
      }

      await removeParticipant({
        roomId: roomId,
        channelId: channelId,
        code: meetingCode,
        identity: identity,
      }).unwrap();

      setKickedUsers((prev) => [...prev, identity]);
    } catch (error) {
      console.error(error);
      alert("Không thể thực hiện thao tác đuổi khỏi phòng!");
    } finally {
      setKickingUserId(null);
    }
  };

  // Lọc bỏ những người đã bị kick trước khi render
  const displayParticipants = participants.filter(
    (p) => !kickedUsers.includes(p.identity),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Hiển thị tổng số người */}
      <div className="flex items-center justify-between mb-4 px-1">
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
                {/* Trạng thái Mic */}
                <div className="text-slate-400 mr-1">
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
                        <button className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2.5 transition-colors">
                          <Edit2 size={15} /> Đổi tên
                        </button>

                        {/* CHỈ HIỆN KICK NẾU MÌNH LÀ ADMIN VÀ NGƯỜI BỊ KICK KHÔNG PHẢI LÀ MÌNH */}
                        {isLocalAdmin && !isMe && (
                          <>
                            <div className="h-px bg-slate-700 my-1"></div>
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
    </div>
  );
}
/**
 * COMPONENT: Thanh điều khiển (Toolbar)
 */
function CustomToolbar({
  activeTab,
  onToggleSidebar,
}: {
  activeTab: "chat" | "people" | null;
  onToggleSidebar: (tab: "chat" | "people") => void;
}) {
  // 1. Trích xuất thêm isScreenShareEnabled từ useLocalParticipant
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();

  const [isHandRaised, setIsHandRaised] = useState(false);

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  // 2. Hàm bật/tắt chia sẻ màn hình (bọc trong try-catch phòng trường hợp user ấn Hủy cấp quyền)
  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (error) {
      console.error("Lỗi khi chia sẻ màn hình:", error);
    }
  };

  const leaveMeeting = () => window.close();

  return (
    <footer className="h-auto min-h-20 sm:h-20 shrink-0 flex flex-wrap items-center justify-center sm:justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800/60 z-30 gap-4 py-2 sm:py-0">
      <div className="hidden sm:flex items-center w-50">
        <span className="text-slate-400 text-sm font-medium">
          Đã mã hóa đầu cuối
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleCam}
          className={`p-3 rounded-xl transition-all ${
            isCameraEnabled
              ? "bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              : "bg-slate-800 text-slate-400 border border-slate-700/50"
          }`}
        >
          {isCameraEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
        </button>

        <button
          onClick={toggleMic}
          className={`p-3 rounded-xl transition-all ${
            isMicrophoneEnabled
              ? "bg-slate-700 hover:bg-slate-600 text-white shadow-md"
              : "bg-slate-800 text-slate-400 border border-slate-700/50"
          }`}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* 3. Cập nhật nút Share Screen */}
        <button
          onClick={toggleScreenShare}
          title="Chia sẻ màn hình"
          className={`p-3 rounded-xl transition-all shadow-md hidden sm:block ${
            isScreenShareEnabled
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 border border-blue-500" // Trạng thái đang share
              : "bg-slate-700 hover:bg-slate-600 text-white" // Trạng thái bình thường
          }`}
        >
          <MonitorUp size={20} />
        </button>

        <button
          onClick={() => setIsHandRaised(!isHandRaised)}
          className={`p-3 rounded-xl transition-all shadow-md ${
            isHandRaised
              ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
              : "bg-slate-700 hover:bg-slate-600 text-white"
          }`}
        >
          <Hand size={20} />
        </button>

        <div className="w-px h-8 bg-slate-700 mx-1 sm:mx-2 hidden sm:block"></div>

        <button
          onClick={leaveMeeting}
          className="px-4 sm:px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 ml-2"
        >
          <PhoneOff size={18} />
          <span className="hidden sm:inline">Rời đi</span>
        </button>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 w-auto sm:w-50 justify-end">
        <button
          onClick={() => onToggleSidebar("people")}
          className={`p-2.5 rounded-lg transition-colors ${
            activeTab === "people"
              ? "bg-slate-700 text-brand-400"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          <Users size={20} />
        </button>
        <button
          onClick={() => onToggleSidebar("chat")}
          className={`p-2.5 rounded-lg transition-colors ${
            activeTab === "chat"
              ? "bg-slate-700 text-brand-400"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          <MessageSquare size={20} />
        </button>
      </div>
    </footer>
  );
}

/**
 * COMPONENT: Wrapper thông minh cho từng ô Video
 * Xử lý: Ép khung hình vuông, hiển thị Avatar khi tắt Camera
 */
function CustomTileWrapper({
  trackRef,
  className,
  isMain = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  isMain?: boolean;
}) {
  const participant = trackRef.participant;
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;

  // Giải mã Avatar từ metadata (giống hệt logic ở ParticipantList)
  let avatarUrl = "";
  try {
    if (participant.metadata) {
      avatarUrl = JSON.parse(participant.metadata).avatarUrl;
    }
  } catch (error) {}

  // Kiểm tra xem camera có đang tắt hay không
  const isCameraOff = !isScreenShare && !participant.isCameraEnabled;

  return (
    <div className={`relative bg-[#1a1a1a] ${className}`}>
      {/* 1. Tile mặc định của LiveKit */}
      <ParticipantTile
        trackRef={trackRef}
        className="w-full h-full"
        // Nếu là màn hình Share chính thì giữ nguyên tỷ lệ (contain), còn camera thì cắt vuông (cover)
        style={{
          objectFit: isMain && isScreenShare ? "contain" : "cover",
        }}
      />

      {/* 2. Lớp Overlay hiển thị Avatar (Chỉ hiện khi tắt Camera) */}
      {isCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#1f1f1f]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.name}
              className={`${
                isMain ? "w-40 h-40" : "w-24 h-24"
              } rounded-full object-cover border-[3px] border-slate-700 shadow-xl`}
            />
          ) : (
            <div
              className={`${
                isMain ? "w-40 h-40 text-5xl" : "w-24 h-24 text-3xl"
              } rounded-full bg-brand-600/20 text-brand-400 flex items-center justify-center font-bold uppercase border-[3px] border-brand-600/30 shadow-xl`}
            >
              {participant.name?.charAt(0) || "?"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
