"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
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
import { toast } from "sonner";
import { useGeneratePresignedUploadUrlMutation } from "@/lib/redux/api/meetingsApi";

interface MeetingChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  meetingCode: string;
}

export default function MeetingChat({
  setMessages,
  messages,
  meetingCode,
}: MeetingChatProps) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [generatePresignedUrl] = useGeneratePresignedUploadUrlMutation();

  const [inputValue, setInputValue] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("all");
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);

  // State quản lý Modal xem chi tiết cảm xúc
  const [reactionDetails, setReactionDetails] = useState<{
    [emoji: string]: string[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // tối đa 50MB

  // Upload file dùng S3 presigned url
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localParticipant) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Chỉ hỗ trợ file dưới 50MB!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const toastId = toast.loading(`Đang tải lên ${file.name}...`);

    try {
      // Xin presigned url từ BE
      const { presignedUrl, publicUrl } = await generatePresignedUrl({
        fileName: file.name,
        meetingCode: meetingCode,
      }).unwrap();

      // Upload trực tiếp lên S3 (supabase storage)
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Lỗi khi tải file lên máy chủ lưu trữ");
      }

      const isPrivate = selectedTarget !== "all";
      const fileMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        type: "CHAT",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: Date.now(),
        isPrivate: isPrivate,
        targetName: isPrivate
          ? participants.find((p) => p.identity === selectedTarget)?.name
          : undefined,
        fileName: file.name,
        fileType: file.type,
        publicUrl: publicUrl,
      };

      const encoder = new TextEncoder();
      let destinationIdentities: string[] = [];
      if (isPrivate) {
        destinationIdentities = [selectedTarget];
      }

      // Gửi qua LiveKit
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(fileMsg)),
        {
          reliable: true,
          ...(destinationIdentities.length > 0 && { destinationIdentities }),
        },
      );

      setMessages((prev) => [...prev, fileMsg]);
      toast.success("Tải file thành công!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi tải file lên", { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        toast.error("Người nhận không có trong phòng hoặc đã rời phòng.");
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
      reactions: {},

      // Nhét thông tin Reply vào (nếu có)
      ...(replyingTo && {
        replyToMsgId: replyingTo.id,
        replyToSender: replyingTo.senderName,
        replyToContent:
          replyingTo.content ||
          (replyingTo.fileName
            ? `[Tệp] ${replyingTo.fileName}`
            : "[Ảnh/Video]"),
      }),
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
      setReplyingTo(null);
    } catch (error) {
      toast.error("Gửi tin nhắn thất bại. Vui lòng thử lại.");
    }
  };

  // Hàm xử lý khi người dùng thả cảm xúc vào tin nhắn
  const handleReact = async (targetMessageId: string, emoji: string) => {
    if (!localParticipant) return;

    const reactMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type: "REACT",
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || "Bạn",
      timestamp: Date.now(),
      isPrivate: false,
      targetMessageId,
      emoji,
    };

    const encoder = new TextEncoder();
    try {
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(reactMsg)),
        { reliable: true },
      );

      // Tự cập nhật vào UI của chính mình ngay lập tức
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === targetMessageId) {
            const newReactions = { ...(msg.reactions || {}) };
            const users = newReactions[emoji] || [];
            if (!users.includes(localParticipant.identity)) {
              newReactions[emoji] = [...users, localParticipant.identity];
            } else {
              newReactions[emoji] = users.filter(
                (id) => id !== localParticipant.identity,
              );
            }
            return { ...msg, reactions: newReactions };
          }
          return msg;
        }),
      );
    } catch (error) {}
  };

  const otherParticipants = participants.filter(
    (p) => p.identity !== localParticipant?.identity,
  );
  // Danh sách cảm xúc cơ bản
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😡", "🎉"];

  // Hàm lấy thông tin chi tiết (Tên + Avatar) của người dùng
  const getParticipantDetails = (id: string) => {
    let name = "Người dùng ẩn danh";
    let avatarUrl = "";

    // Tìm user trong phòng hoặc chính mình
    const p =
      id === localParticipant?.identity
        ? localParticipant
        : participants.find((x) => x.identity === id);

    if (p) {
      name = p.name || name;
      // Thử trích xuất avatar từ metadata (nếu backend của bạn có set metadata lúc tạo token)
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          avatarUrl = meta.avatar || meta.avatarUrl || meta.picture || "";
        }
      } catch (e) {}
    }

    // Nếu là chính mình thì hiện chữ "Bạn", nhưng vẫn lấy đúng chữ cái đầu của tên thật
    const displayName = id === localParticipant?.identity ? "Bạn" : name;
    const initial = name.charAt(0).toUpperCase();

    return { displayName, initial, avatarUrl };
  };

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
              className="bg-slate-800 rounded-2xl w-full max-w-xs border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-700/50">
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
                      <div className="text-sm border-b border-slate-700/50 pb-1 mb-1 flex items-center gap-2">
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
                            className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-700/40 rounded-lg transition-colors"
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

      <div className="flex-1 pt-4 overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar">
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
                className={`group flex flex-col relative ${isMe ? "items-end" : "items-start"}`}
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
                  {/* THANH MENU NỔI KHI HOVER */}
                  <div
                    className={`absolute -top-10 ${isMe ? "right-2" : "left-2"} opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/95 backdrop-blur-sm border border-slate-700/80 rounded-xl shadow-xl flex items-center p-1 z-20 gap-0.5`}
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
                        {msg.replyToSender}
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
        {/* BANNER HIỂN THỊ ĐANG TRẢ LỜI AI ĐÓ */}
        {replyingTo && (
          <div className="bg-slate-800/80 px-3 py-2 rounded-xl text-xs text-slate-300 flex justify-between items-center border border-slate-700 backdrop-blur-sm">
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
          Chỉ cho phép gửi file dưới 50MB, chỉ chọn và gửi được 1 file tại 1
          thời điểm. Ảnh/Video sẽ hiển thị trực tiếp, các loại file khác sẽ hiển
          thị dưới dạng thẻ tải xuống.
        </p>
      </div>
    </div>
  );
}
