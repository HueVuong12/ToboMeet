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

  const storageKey = `meeting_chat_${meetingCode}`;

  // Bộ đệm hứng file từ người khác
  const fileReceiveBuffer = useRef<{ [fileId: string]: string[] }>({});
  // Bộ đệm lưu trữ file gốc của MÌNH để sẵn sàng gửi bù nếu bị đòi
  const activeUploadsRef = useRef<{ [fileId: string]: string }>({});

  // Dùng useRef để tránh "stale closure" trong sự kiện LiveKit
  const isChatOpenRef = useRef(false);
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

        // Nhận dữ liệu chat từ người khác
        if (data.type === "CHAT") {
          setMessages((prev) => [...prev, data]);
          if (!isChatOpenRef.current) setHasUnreadChat(true);
        }

        // Bắt đầu nhận file từ người khác
        else if (data.type === "FILE_START" && data.fileId) {
          fileReceiveBuffer.current[data.fileId] = new Array(data.totalChunks);
        }

        // Nhận từng chunk file, lưu vào bộ đệm, chờ FILE_DONE để ráp file
        else if (
          data.type === "FILE_CHUNK" &&
          data.fileId &&
          data.chunkData !== undefined
        ) {
          fileReceiveBuffer.current[data.fileId][data.chunkIndex!] =
            data.chunkData;
        }

        // Kết thúc nhận file, ráp file và hiển thị, hoặc đòi nợ nếu thiếu chunk
        else if (data.type === "FILE_DONE" && data.fileId) {
          const buffer = fileReceiveBuffer.current[data.fileId];
          const missing: number[] = [];

          for (let i = 0; i < data.totalChunks!; i++) {
            if (!buffer[i]) missing.push(i);
          }

          if (missing.length > 0) {
            // Nếu thiếu mảnh, gửi lại yêu cầu đòi nợ
            console.warn(`Rớt ${missing.length} mảnh. Đang đòi lại...`);
            const nackMsg: ChatMessage = {
              id: Math.random().toString(36).substring(2, 9),
              type: "MISSING_CHUNKS",
              senderIdentity: room.localParticipant.identity,
              senderName: room.localParticipant.name || "Bạn",
              timestamp: Date.now(),
              isPrivate: true,
              targetName: data.senderIdentity,
              fileId: data.fileId,
              missingIndices: missing,
            };

            const encoder = new TextEncoder();
            room.localParticipant.publishData(
              encoder.encode(JSON.stringify(nackMsg)),
              {
                reliable: true,
                destinationIdentities: [data.senderIdentity],
              },
            );
          } else {
            // NẾU ĐỦ: Ráp file và hiển thị
            const allChunks = buffer.join("");
            const mimeType = data.fileType || "application/octet-stream";

            // Thuật toán giải mã Base64 sang Blob và tạo URL ảo
            let completeDataUrl = "";
            try {
              // 1. Dịch ngược chuỗi Base64 thành chuỗi byte
              const byteString = atob(allChunks);

              // 2. Tạo mảng nhị phân (ArrayBuffer) có kích thước bằng file
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);

              // 3. Đổ dữ liệu vào mảng
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }

              // 4. Đóng gói thành Blob và tạo URL ảo siêu ngắn
              const blob = new Blob([ab], { type: mimeType });
              completeDataUrl = URL.createObjectURL(blob);
            } catch (error) {
              console.error("Lỗi khi giải mã Base64 sang Blob:", error);
              // Fallback nếu có lỗi
              completeDataUrl = `data:${mimeType};base64,${allChunks}`;
            }

            const finalMessage: ChatMessage = {
              id: data.id,
              type: "CHAT",
              senderIdentity: data.senderIdentity,
              senderName: data.senderName,
              timestamp: data.timestamp,
              isPrivate: data.isPrivate,
              targetName: data.targetName,
              fileName: data.fileName,
              fileType: data.fileType,
              chunkData: completeDataUrl,
            };

            setMessages((prev) => [...prev, finalMessage]);
            if (!isChatOpenRef.current) setHasUnreadChat(true);

            delete fileReceiveBuffer.current[data.fileId]; // Dọn rác
          }
        }

        // [NGƯỜI GỬI] BỊ ĐÒI NỢ -> GỬI BÙ MẢNH RỚT
        else if (
          data.type === "MISSING_CHUNKS" &&
          data.fileId &&
          data.missingIndices
        ) {
          const base64Data = activeUploadsRef.current[data.fileId];

          if (base64Data) {
            console.log(`Đang gửi bù ${data.missingIndices.length} mảnh...`);
            const encoder = new TextEncoder();
            const CHUNK_SIZE = 16 * 1024;

            // Chạy ngầm để không block UI
            (async () => {
              for (const missingIndex of data.missingIndices!) {
                const start = missingIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, base64Data.length);
                const chunkBase64 = base64Data.slice(start, end);

                const chunkMsg: ChatMessage = {
                  id: Math.random().toString(36).substring(2, 9),
                  type: "FILE_CHUNK",
                  senderIdentity: room.localParticipant.identity,
                  senderName: room.localParticipant.name || "Bạn",
                  timestamp: Date.now(),
                  isPrivate: true,
                  fileId: data.fileId,
                  chunkIndex: missingIndex,
                  chunkData: chunkBase64,
                };

                await room.localParticipant.publishData(
                  encoder.encode(JSON.stringify(chunkMsg)),
                  {
                    reliable: true,
                    destinationIdentities: [data.senderIdentity],
                  },
                );

                await new Promise((resolve) => setTimeout(resolve, 5)); // Vẫn phải Sleep
              }

              // Gửi lại FILE_DONE
              const doneMsg: ChatMessage = {
                id: Math.random().toString(36).substring(2, 9),
                type: "FILE_DONE",
                senderIdentity: room.localParticipant.identity,
                senderName: room.localParticipant.name || "Bạn",
                timestamp: Date.now(),
                isPrivate: true,
                fileId: data.fileId,
                totalChunks: Math.ceil(base64Data.length / CHUNK_SIZE),
              };

              await room.localParticipant.publishData(
                encoder.encode(JSON.stringify(doneMsg)),
                {
                  reliable: true,
                  destinationIdentities: [data.senderIdentity],
                },
              );
            })();
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
                <MeetingChat
                  activeUploadsRef={activeUploadsRef}
                  messages={messages}
                  setMessages={setMessages}
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
