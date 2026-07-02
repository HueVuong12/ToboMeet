"use client";

import { useSearchParams } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import { X } from "lucide-react";
import { useState } from "react";
import "@livekit/components-styles";
import ParticipantList from "@/components/meeting/ParticipantList";
import CustomToolbar from "@/components/meeting/CustomToolbar";
import CustomVideoGrid from "@/components/meeting/CustomVideoGrid";

export default function MeetingPage() {
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
