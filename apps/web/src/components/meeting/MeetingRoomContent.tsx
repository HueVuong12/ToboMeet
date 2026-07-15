// src/app/[locale]/room/[id]/page.tsx
"use client";

import { useRoomContext } from "@livekit/components-react";
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

export default function MeetingRoomContent({
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
  const [screenSources, setScreenSources] = useState<any[]>([]);

  const storageKey = `meeting_chat_${meetingCode}`;

  // Dùng useRef để tránh "stale closure" trong sự kiện LiveKit
  const isChatOpenRef = useRef(false);

  useEffect(() => {
    // Kiểm tra xem có đang chạy trong Electron không
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      (window as any).electronAPI.onScreenShareRequest((sources: any[]) => {
        setScreenSources(sources); // Mở modal và hiển thị danh sách
      });
    }
  }, []);

  const handleSelectSource = (id: string | null) => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.selectScreenShare(id); // Gửi ID về lại cho Electron
    }
    setScreenSources([]); // Đóng modal
  };

  useEffect(() => {
    isChatOpenRef.current = isSidebarOpen && sidebarTab === "chat";
    // Nếu vừa mở khung chat lên, tắt chấm đỏ ngay
    if (isChatOpenRef.current) {
      setHasUnreadChat(false);
    }
  }, [isSidebarOpen, sidebarTab]);

  // Load dữ liệu chat từ Indexed DB khi component mount
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

  // Lưu dữ liệu chat vào Indexed DB khi có tin nhắn mới
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

  // Lắng nghe sự kiện nhận dữ liệu từ LiveKit
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload);

      try {
        const data = JSON.parse(jsonString) as ChatMessage;

        // Nhận dữ liệu CHAT (bao gồm cả File dạng Link S3)
        if (data.type === "CHAT") {
          data.reactions = data.reactions || {};
          setMessages((prev) => [...prev, data]);
          if (!isChatOpenRef.current) setHasUnreadChat(true);
        }

        // Xử lý thả cảm xúc (REACTION)
        else if (data.type === "REACT" && data.targetMessageId && data.emoji) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === data.targetMessageId) {
                const newReactions = { ...(msg.reactions || {}) };
                const usersWhoReacted = newReactions[data.emoji!] || [];

                if (!usersWhoReacted.includes(data.senderIdentity)) {
                  newReactions[data.emoji!] = [
                    ...usersWhoReacted,
                    data.senderIdentity,
                  ];
                } else {
                  newReactions[data.emoji!] = usersWhoReacted.filter(
                    (id) => id !== data.senderIdentity,
                  );
                }
                return { ...msg, reactions: newReactions };
              }
              return msg;
            }),
          );
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
                <MeetingChat
                  messages={messages}
                  setMessages={setMessages}
                  meetingCode={meetingCode}
                />
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
        {/* MODAL CHỌN MÀN HÌNH CHIA SẺ (CHỈ HIỂN THỊ KHI CHẠY TRÊN ELECTRON) */}
        {screenSources.length > 0 && (
          <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-slate-100">
                  Chọn nội dung chia sẻ
                </h2>
                <button
                  onClick={() => handleSelectSource(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {screenSources.map((source) => (
                    <div
                      key={source.id}
                      onClick={() => handleSelectSource(source.id)}
                      className="flex flex-col gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-700 hover:border-emerald-500/50 rounded-xl cursor-pointer transition-all group"
                    >
                      <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-900 group-hover:shadow-lg">
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-300 text-center truncate px-2">
                        {source.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 flex justify-end shrink-0 bg-slate-900/50 rounded-b-2xl">
                <button
                  onClick={() => handleSelectSource(null)}
                  className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

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
