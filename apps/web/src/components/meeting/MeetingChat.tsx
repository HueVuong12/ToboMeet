"use client";

import { useState, useEffect, useRef, MutableRefObject } from "react";
import { createPortal } from "react-dom";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { Send, Lock, Paperclip, FileText, X, ChevronDown } from "lucide-react";
import { ChatMessage } from "@tobomeet/shared/types";

interface MeetingChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeUploadsRef: MutableRefObject<{ [fileId: string]: string }>;
}

export default function MeetingChat({
  setMessages,
  messages,
  activeUploadsRef,
}: MeetingChatProps) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [inputValue, setInputValue] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<string>("all");
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CHUNK_SIZE = 16 * 1024;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localParticipant) return;

    if (file.size > 100 * 1024 * 1024) {
      alert("Chỉ hỗ trợ file dưới 100MB!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const fullDataUrl = ev.target?.result as string;
      const base64Data = fullDataUrl.split(",")[1];

      const fileId = Math.random().toString(36).substring(2, 15);
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);

      activeUploadsRef.current[fileId] = base64Data;

      const startMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        type: "FILE_START",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: Date.now(),
        isPrivate: selectedTarget !== "all",
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks,
      };

      const encoder = new TextEncoder();
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(startMsg)),
        { reliable: true },
      );

      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          type: "FILE_CHUNK",
          senderIdentity: localParticipant.identity,
          senderName: localParticipant.name || "Bạn",
          timestamp: Date.now(),
          isPrivate: selectedTarget !== "all",
          fileId,
          chunkIndex: i,
          chunkData: chunkStr,
        };

        await localParticipant.publishData(
          encoder.encode(JSON.stringify(chunkMsg)),
          { reliable: true },
        );
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const doneMsg: ChatMessage = {
        ...startMsg,
        id: Math.random().toString(36).substring(2, 9),
        type: "FILE_DONE",
      };
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(doneMsg)),
        { reliable: true },
      );

      const finalMessage: ChatMessage = {
        id: startMsg.id,
        type: "CHAT",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: startMsg.timestamp,
        isPrivate: startMsg.isPrivate,
        targetName:
          selectedTarget !== "all"
            ? participants.find((p) => p.identity === selectedTarget)?.name
            : undefined,
        fileName: file.name,
        fileType: file.type,
        chunkData: URL.createObjectURL(file),
      };

      setMessages((prev) => [...prev, finalMessage]);

      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsDataURL(file);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    try {
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(newMessage)),
        {
          reliable: true,
          destinationIdentities: destinationIdentities,
        },
      );
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
    <div className="flex flex-col h-full bg-transparent relative">
      {/* MODAL PHÓNG TO ẢNH VÀ VIDEO */}
      {previewMedia &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setPreviewMedia(null)}
          >
            <div
              className="relative max-w-full max-h-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewMedia(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-red-400 bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>

              {previewMedia.type.startsWith("image/") ? (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.name}
                  className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                />
              ) : previewMedia.type.startsWith("video/") ? (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl"
                />
              ) : null}

              <a
                href={previewMedia.url}
                download={previewMedia.name}
                className="mt-4 text-sm text-slate-300 hover:text-emerald-400 underline"
              >
                Tải xuống: {previewMedia.name}
              </a>
            </div>
          </div>,
          document.body,
        )}

      {/* Ẩn input file */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

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

                {/* Wrapper tách biệt các thành phần để File/Media không bị dính background */}
                <div
                  className={`relative max-w-[90%] flex flex-col gap-1.5 ${isMe ? "items-end" : "items-start"}`}
                >
                  {/* HIỂN THỊ ẢNH/VIDEO (Không bọc nền màu) */}
                  {msg.chunkData &&
                    (msg.fileType?.startsWith("image/") ||
                      msg.fileType?.startsWith("video/")) && (
                      <div
                        className="cursor-pointer overflow-hidden rounded-xl relative group shadow-sm bg-slate-900/30"
                        onClick={() =>
                          setPreviewMedia({
                            url: msg.chunkData!,
                            type: msg.fileType!,
                            name: msg.fileName!,
                          })
                        }
                      >
                        {msg.fileType?.startsWith("image/") ? (
                          <img
                            src={msg.chunkData}
                            alt={msg.fileName}
                            className="max-w-full max-h-48 object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <video
                            src={msg.chunkData}
                            className="max-w-full max-h-48 object-cover"
                          />
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white bg-black/60 px-3 py-1.5 rounded-md text-xs font-medium backdrop-blur-sm shadow-lg">
                            Phóng to
                          </span>
                        </div>
                      </div>
                    )}

                  {/* HIỂN THỊ TÀI LIỆU KHÁC (Được style lại dạng thẻ Card đẹp mắt) */}
                  {msg.chunkData &&
                    !msg.fileType?.startsWith("image/") &&
                    !msg.fileType?.startsWith("video/") && (
                      <a
                        href={msg.chunkData}
                        download={msg.fileName}
                        className="flex items-center gap-2 p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-600/50 shadow-sm w-full"
                      >
                        <FileText
                          size={18}
                          className={
                            isMe ? "text-emerald-400" : "text-brand-400"
                          }
                        />
                        <span className="truncate text-sm font-medium underline underline-offset-2 text-slate-200">
                          {msg.fileName}
                        </span>
                      </a>
                    )}

                  {/* HIỂN THỊ TEXT (Chỉ bọc màu nền cho đoạn text) */}
                  {msg.content && (
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm shadow-sm ${isMe ? "bg-emerald-600 text-white rounded-tr-sm" : "bg-slate-700 text-slate-100 rounded-tl-sm"}`}
                    >
                      <p className="whitespace-pre-wrap wrap-break-words">
                        {msg.content}
                      </p>
                    </div>
                  )}
                </div>

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

      <div className="shrink-0 flex flex-col gap-2">
        <div className="relative">
          <select
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="w-full appearance-none bg-slate-800 text-slate-200 text-xs pl-3 pr-8 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500/50 cursor-pointer transition-colors"
          >
            <option value="all">Mọi người trong phòng</option>
            {otherParticipants.map((p) => (
              <option key={p.identity} value={p.identity}>
                Chỉ gửi: {p.name}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown size={14} />
          </div>
        </div>

        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center bg-slate-950 rounded-xl border border-slate-700 p-1 focus-within:border-emerald-500/50 transition-colors"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-transparent text-sm text-slate-200 px-2 py-2 focus:outline-none min-w-0"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:bg-slate-700 ml-1 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>

        {/* Chú thích dung lượng */}
        <p className="text-[10px] text-slate-500 text-center mt-0.5">
          Chỉ cho phép gửi file dưới 100MB
        </p>
      </div>
    </div>
  );
}
