"use client";

import { useState, useEffect, useRef } from "react";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { Send, Lock } from "lucide-react";
import { ChatMessage } from "@tobomeet/shared/types";

interface MeetingChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export default function MeetingChat({
  setMessages,
  messages,
}: MeetingChatProps) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [inputValue, setInputValue] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cuộn xuống tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // GỬI TIN NHẮN
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !localParticipant) return;

    const isPrivate = selectedTarget !== "all";
    let targetName = "";
    let destinationIdentities: string[] = [];

    if (isPrivate) {
      const targetParticipant = participants.find(
        (p) => p.identity === selectedTarget,
      );
      if (targetParticipant) {
        destinationIdentities = [targetParticipant.identity];
        targetName = targetParticipant.name || "Ẩn danh";
      } else {
        alert("Người này không còn trong phòng.");
        return;
      }
    }

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type: "CHAT",
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || "Bạn",
      content: inputValue.trim(),
      timestamp: Date.now(),
      isPrivate,
      targetName,
    };

    const encoder = new TextEncoder();
    const dataUint8 = encoder.encode(JSON.stringify(newMessage));

    try {
      await localParticipant.publishData(dataUint8, {
        reliable: true,
        destinationIdentities: destinationIdentities,
      });

      // Bắn tin nhắn mới lên mảng của component cha (page.tsx)
      setMessages((prev) => [...prev, newMessage]);
      setInputValue("");
    } catch (error) {
      alert("Không thể gửi tin nhắn");
    }
  };

  const otherParticipants = participants.filter(
    (p) => p.identity !== localParticipant?.identity,
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* KHU VỰC HIỂN THỊ TIN NHẮN */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Chưa có tin nhắn nào. Bắt đầu trò chuyện!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderIdentity === localParticipant?.identity;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-slate-300">
                    {isMe ? "Bạn" : msg.senderName}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  className={`
                    relative max-w-[90%] px-3 py-2 rounded-2xl text-sm 
                    ${isMe ? "bg-emerald-600 text-white rounded-tr-sm" : "bg-slate-700 text-slate-100 rounded-tl-sm"}
                    ${msg.isPrivate ? "ring-1 ring-amber-500/50" : ""}
                  `}
                >
                  <p className="wrap-break-word">{msg.content}</p>
                </div>

                {/* Hiển thị chú thích nếu là tin nhắn riêng tư */}
                {msg.isPrivate && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500/80">
                    <Lock size={10} />
                    <span>
                      {isMe
                        ? `Gửi riêng cho ${msg.targetName}`
                        : "Gửi riêng cho bạn"}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* KHU VỰC NHẬP TIN NHẮN */}
      <div className="shrink-0 flex flex-col gap-2">
        {/* Dropdown chọn người nhận */}
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
          className="w-full bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors"
        >
          <option value="all">Mọi người trong phòng</option>
          {otherParticipants.map((p) => (
            <option key={p.identity} value={p.identity}>
              Chỉ gửi: {p.name}
            </option>
          ))}
        </select>

        {/* Form nhập liệu */}
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center bg-slate-950 rounded-xl border border-slate-700 focus-within:border-emerald-500/50 transition-colors p-1 pr-1.5"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-transparent text-sm text-slate-200 px-3 py-2 focus:outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:bg-slate-700 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
