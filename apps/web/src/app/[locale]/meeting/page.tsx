// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { LiveKitRoom, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import localforage from "localforage";
import "@livekit/components-styles";
import ParticipantList from "@/components/meeting/ParticipantList";
import CustomToolbar from "@/components/meeting/CustomToolbar";
import CustomVideoGrid from "@/components/meeting/CustomVideoGrid";
import MeetingChat from "@/components/meeting/MeetingChat";
import { ChatMessage } from "@tobomeet/shared/types";

function MeetingRoomContent({
  channelName,
  roomId,
  channelId,
  meetingCode,
}: any) {
  const room = useRoomContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "people">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  const storageKey = `meeting_chat_${meetingCode}`;

  // Dùng useRef để tránh "stale closure" trong sự kiện LiveKit
  const isChatOpenRef = useRef(false);
  useEffect(() => {
    isChatOpenRef.current = isSidebarOpen && sidebarTab === "chat";
    // Nếu vừa mở khung chat lên, tắt chấm đỏ ngay
    if (isChatOpenRef.current) {
      setHasUnreadChat(false);
    }
  }, [isSidebarOpen, sidebarTab]);

  // LOAD DỮ LIỆU TỪ INDEXED DB KHI VÀO PHÒNG
  useEffect(() => {
    const loadSavedChat = async () => {
      try {
        const savedChat = await localforage.getItem<ChatMessage[]>(storageKey);
        if (savedChat && Array.isArray(savedChat)) {
          setMessages(savedChat);
        }
      } catch (error) {}
    };
    loadSavedChat();
  }, [storageKey]);

  // LƯU DỮ LIỆU VÀO INDEXED DB KHI CÓ TIN NHẮN MỚI
  useEffect(() => {
    if (messages.length > 0) {
      const saveChat = async () => {
        try {
          const MAX_MESSAGES_TO_SAVE = 10000;
          const messagesToSave =
            messages.length > MAX_MESSAGES_TO_SAVE
              ? messages.slice(messages.length - MAX_MESSAGES_TO_SAVE)
              : messages;
          await localforage.setItem(storageKey, messagesToSave);
        } catch (error) {}
      };
      saveChat();
    }
  }, [messages, storageKey]);

  // LẮNG NGHE TIN NHẮN TỪ LIVEKIT (LUÔN LUÔN CHẠY)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload);

      try {
        const data = JSON.parse(jsonString) as ChatMessage;
        if (data.type === "CHAT") {
          setMessages((prev) => [...prev, data]);

          // Nếu khung chat đang đóng, bật chấm đỏ lên
          if (!isChatOpenRef.current) {
            setHasUnreadChat(true);
          }
        }
      } catch (error) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  return (
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
        <div className="flex-1 flex flex-col h-full min-w-0">
          <div className="flex-1 bg-slate-950 rounded-3xl border border-slate-800/60 shadow-2xl relative overflow-hidden">
            <CustomVideoGrid />
          </div>
        </div>

        {isSidebarOpen && (
          <aside className="z-20 flex flex-col shrink-0 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] sm:relative sm:inset-auto sm:w-80 sm:h-full">
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
                <MeetingChat messages={messages} setMessages={setMessages} />
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

      <div className="shrink-0 w-full z-30">
        <CustomToolbar
          meetingCode={meetingCode || ""}
          hasUnreadChat={hasUnreadChat}
          activeTab={isSidebarOpen ? sidebarTab : null}
          onToggleSidebar={(tab) => {
            if (isSidebarOpen && sidebarTab === tab) setIsSidebarOpen(false);
            else {
              setSidebarTab(tab);
              setIsSidebarOpen(true);
            }
          }}
        />
      </div>
    </div>
  );
}

export default function MeetingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const channelName = searchParams.get("channelName");
  const roomId = searchParams.get("roomId");
  const channelId = searchParams.get("channelId");
  const meetingCode = searchParams.get("meetingCode");

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
      <MeetingRoomContent
        channelName={channelName}
        roomId={roomId}
        channelId={channelId}
        meetingCode={meetingCode}
      />
    </LiveKitRoom>
  );
}
