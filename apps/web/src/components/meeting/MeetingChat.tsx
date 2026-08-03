"use client";

import { createPortal } from "react-dom";
import {
  Send,
  Lock,
  Paperclip,
  FileText,
  X,
  ChevronDown,
  Reply,
  Info,
} from "lucide-react";
import { ChatMessage } from "@tobomeet/shared/types";
import { useChatManager } from "@/hooks/useChatManager";
import { useRoomSettings } from "@/hooks/useRoomSettings";

interface MeetingChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  meetingCode: string;
  roomId: string;
  channelId: string;
}

export default function MeetingChat({
  setMessages,
  messages,
  meetingCode,
  roomId,
  channelId,
}: MeetingChatProps) {
  const { canChat } = useRoomSettings({ roomId, channelId, meetingCode });
  const {
    localParticipant,
    otherParticipants,
    inputValue,
    setInputValue,
    replyingTo,
    setReplyingTo,
    selectedTarget,
    setSelectedTarget,
    previewMedia,
    setPreviewMedia,
    reactionDetails,
    setReactionDetails,
    scrollContainerRef,
    fileInputRef,
    QUICK_EMOJIS,
    handleSendMessage,
    handleFileChange,
    handleReact,
    getParticipantDetails,
  } = useChatManager({ messages, setMessages, meetingCode });

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* MODAL XEM CHI TIẾT CẢM XÚC */}
      {reactionDetails &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setReactionDetails(null)}
          >
            <div
              className="bg-[#222] border-[#333] rounded-2xl w-full max-w-xs border shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-[#333]">
                <h3 className="text-sm font-semibold text-slate-200">
                  Chi tiết cảm xúc
                </h3>
                <button
                  onClick={() => setReactionDetails(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {Object.entries(reactionDetails).map(([emoji, users]) => {
                  if (users.length === 0) return null;
                  return (
                    <div key={emoji} className="flex flex-col gap-1.5">
                      <div className="text-sm border-b border-[#333] pb-1 mb-1 flex items-center gap-2">
                        <span className="text-lg">{emoji}</span>
                        <span className="text-xs font-medium text-slate-400">
                          {users.length} người
                        </span>
                      </div>

                      {/* Vòng lặp hiển thị từng người thả cảm xúc */}
                      {users.map((userId) => {
                        const { displayName, initial, avatarUrl } =
                          getParticipantDetails(userId);

                        return (
                          <div
                            key={userId}
                            className="flex items-center gap-3 px-2 py-1.5 hover:bg-[#333] rounded-lg transition-colors"
                          >
                            {/* Hiển thị Avatar thật hoặc Avatar chữ cái */}
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={displayName}
                                className="w-6 h-6 rounded-full object-cover bg-slate-700 border border-slate-600"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs text-white font-bold shadow-sm">
                                {initial}
                              </div>
                            )}

                            {/* Tên người dùng */}
                            <span className="text-sm text-slate-300 font-medium">
                              {displayName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal phóng to ảnh và video */}
      {previewMedia &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30 backdrop-blur-md animate-fade-in p-4"
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
        disabled={!canChat}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 pt-4 overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Chưa có tin nhắn nào. Bắt đầu trò chuyện!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderIdentity === localParticipant?.identity;
            const { displayName: realtimeSenderName } = getParticipantDetails(
              msg.senderIdentity,
              msg.senderName,
            );

            let realtimeReplySenderName = msg.replyToSender;
            if (msg.replyToMsgId) {
              const originalMsg = messages.find(
                (m) => m.id === msg.replyToMsgId,
              );
              if (originalMsg) {
                realtimeReplySenderName = getParticipantDetails(
                  originalMsg.senderIdentity,
                  msg.replyToSender,
                ).displayName;
              }
            }

            return (
              <div
                key={msg.id}
                className={`group flex flex-col relative ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-slate-300">
                    {realtimeSenderName}
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
                  {/* THANH MENU NỔI KHI HOVER */}
                  <div
                    className={`absolute -top-10 ${isMe ? "right-2" : "left-2"} opacity-0 group-hover:opacity-100 transition-opacity bg-[#222] border-[#333] backdrop-blur-sm border rounded-xl shadow-xl flex items-center p-1 z-20 gap-0.5`}
                  >
                    <button
                      onClick={() => setReplyingTo(msg)}
                      title="Trả lời"
                      className="p-1.5 text-slate-300 hover:text-emerald-400 hover:bg-slate-700/80 rounded transition-colors"
                    >
                      <Reply size={16} />
                    </button>
                    <div className="w-px h-4 bg-slate-600 mx-1"></div>
                    {QUICK_EMOJIS.map((emj) => (
                      <button
                        key={emj}
                        onClick={() => handleReact(msg.id, emj)}
                        className="px-1.5 py-1 text-base hover:scale-125 transition-transform"
                      >
                        {emj}
                      </button>
                    ))}
                  </div>

                  {/* BLOCK NHÚNG TIN NHẮN REPLY (NẾU CÓ) */}
                  {msg.replyToMsgId && (
                    <div
                      className={`text-[11px] mt-0.5 px-2 py-1 mb-0.5 rounded border-l-2 ${isMe ? "border-emerald-300 bg-emerald-700/30 text-emerald-100" : "border-brand-400 bg-slate-800 text-slate-300"} w-full max-w-xs opacity-80 cursor-pointer line-clamp-2`}
                    >
                      <span className="font-semibold block">
                        {realtimeReplySenderName}
                      </span>
                      {msg.replyToContent}
                    </div>
                  )}

                  {/* HIỂN THỊ ẢNH/VIDEO (Không bọc nền màu) */}
                  {msg.publicUrl &&
                    (msg.fileType?.startsWith("image/") ||
                      msg.fileType?.startsWith("video/")) && (
                      <div
                        className="cursor-pointer overflow-hidden rounded-xl relative group shadow-sm bg-slate-900/30"
                        onClick={() =>
                          setPreviewMedia({
                            url: msg.publicUrl!,
                            type: msg.fileType!,
                            name: msg.fileName!,
                          })
                        }
                      >
                        {msg.fileType?.startsWith("image/") ? (
                          <img
                            src={msg.publicUrl}
                            alt={msg.fileName}
                            className="max-w-full max-h-48 object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <video
                            src={msg.publicUrl}
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
                  {msg.publicUrl &&
                    !msg.fileType?.startsWith("image/") &&
                    !msg.fileType?.startsWith("video/") && (
                      <a
                        href={msg.publicUrl}
                        download={msg.fileName}
                        className="flex items-center gap-2 p-3 rounded-xl transition-colors bg-[#222] border-[#333] hover:bg-[#333]  shadow-sm w-full"
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

                  {/* HIỂN THỊ CÁC REACTION CỦA TIN NHẮN */}
                  {msg.reactions &&
                    Object.values(msg.reactions).some(
                      (users) => users.length > 0,
                    ) && (
                      <div
                        className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"} w-full`}
                      >
                        {Object.entries(msg.reactions).map(([emoji, users]) => {
                          if (users.length === 0) return null;
                          const hasReacted = users.includes(
                            localParticipant?.identity || "",
                          );
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReact(msg.id, emoji)}
                              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ring-1 transition-colors ${hasReacted ? "bg-slate-700 ring-emerald-500 text-emerald-400" : "bg-slate-800/80 ring-slate-700 text-slate-300 hover:bg-slate-700"}`}
                            >
                              <span>{emoji}</span>
                              <span className="font-medium">
                                {users.length}
                              </span>
                            </button>
                          );
                        })}

                        {/* Nút Info để xem chi tiết ai đã thả cảm xúc */}
                        <button
                          onClick={() => setReactionDetails(msg.reactions!)}
                          title="Xem người đã thả cảm xúc"
                          className="ml-0.5 p-0.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-full transition-colors"
                        >
                          <Info size={12} />
                        </button>
                      </div>
                    )}
                </div>

                {msg.isPrivate && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500/80">
                    <Lock size={10} />
                    <span>
                      {isMe
                        ? `Gửi riêng cho ${
                            msg.targetIdentity
                              ? getParticipantDetails(
                                  msg.targetIdentity,
                                  msg.targetName,
                                ).displayName
                              : msg.targetName // Fallback an toàn nếu tin nhắn cũ chưa có targetIdentity
                          }`
                        : "Gửi riêng cho bạn"}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-2 relative">
        {/* LỚP PHỦ LÀM MỜ KHI CHAT BỊ KHÓA */}
        {!canChat && (
          <div className="absolute inset-0 z-10 bg-[#222]/60 border-[#333] backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl pointer-events-none border">
            <div className="bg-slate-800/90 text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 text-xs shadow-lg border border-slate-700/50">
              <Lock size={14} className="text-red-400" />
              Chủ phòng đã khóa chat
            </div>
          </div>
        )}

        {/* BANNER HIỂN THỊ ĐANG TRẢ LỜI AI ĐÓ */}
        {replyingTo && (
          <div className="bg-[#222] border-[#333] px-3 py-2 rounded-xl text-xs text-slate-300 flex justify-between items-center border backdrop-blur-sm">
            <div className="truncate pr-2">
              <span className="font-semibold text-emerald-400 mr-1">
                Đang trả lời {replyingTo.senderName}:
              </span>
              {replyingTo.content ||
                (replyingTo.fileName
                  ? `[Tệp] ${replyingTo.fileName}`
                  : "[Ảnh/Video]")}
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="relative">
          <select
            value={selectedTarget}
            disabled={!canChat}
            onChange={(e) => setSelectedTarget(e.target.value)}
            className="w-full appearance-none text-xs pl-3 pr-8 py-2.5 rounded-lg border bg-[#222] text-gray-200 border-[#333] focus:outline-none focus:border-emerald-500/50 cursor-pointer transition-colors"
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
          className="relative flex items-center rounded-xl border bg-[#222] border-[#333] p-1 focus-within:border-emerald-500/50 transition-colors"
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
            disabled={!canChat}
            placeholder={canChat ? "Nhập tin nhắn..." : "Chat đang bị khóa"}
            className="flex-1 bg-transparent text-sm text-slate-200 px-2 py-2 focus:outline-none min-w-0"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || !canChat}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:bg-slate-700 ml-1 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>

        {/* Chú thích dung lượng */}
        <p className="text-[10px] text-slate-500 text-center mt-0.5">
          Chỉ cho phép gửi file dưới 50MB, chỉ chọn và gửi được 1 file tại 1
          thời điểm. Ảnh/Video sẽ hiển thị trực tiếp, các loại file khác sẽ hiển
          thị dưới dạng thẻ tải xuống.
        </p>
      </div>
    </div>
  );
}
