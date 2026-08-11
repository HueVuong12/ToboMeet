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
import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface MeetingChatProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  meetingCode: string;
  roomId: string;
  channelId: string;
}

/** Nhóm tin nhắn liên tiếp của cùng 1 người */
function groupMessages(messages: ChatMessage[]) {
  const groups: {
    senderIdentity: string;
    senderName: string;
    messages: ChatMessage[];
  }[] = [];

  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.senderIdentity === msg.senderIdentity) {
      last.messages.push(msg);
    } else {
      groups.push({
        senderIdentity: msg.senderIdentity,
        senderName: msg.senderName,
        messages: [msg],
      });
    }
  }
  return groups;
}

export default function MeetingChat({
  setMessages,
  messages,
  meetingCode,
  roomId,
  channelId,
}: MeetingChatProps) {
  const t = useTranslations("meeting.chat");
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

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* ===== MODAL CHI TIẾT CẢM XÚC ===== */}
      {reactionDetails &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setReactionDetails(null)}
          >
            <div
              className="bg-[#1c1c1e] border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-semibold text-slate-200">
                  {t("chat_reaction_details_title")}
                </h3>
                <button
                  onClick={() => setReactionDetails(null)}
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {Object.entries(reactionDetails).map(([emoji, users]) => {
                  if (users.length === 0) return null;
                  return (
                    <div key={emoji} className="flex flex-col gap-1">
                      <div className="text-sm border-b border-white/5 pb-1.5 mb-1 flex items-center gap-2">
                        <span className="text-base">{emoji}</span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {t("chat_reaction_count", { count: users.length })}
                        </span>
                      </div>
                      {users.map((userId) => {
                        const { displayName, initial, avatarUrl } =
                          getParticipantDetails(userId);
                        return (
                          <div
                            key={userId}
                            className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={displayName}
                                className="w-6 h-6 rounded-full object-cover bg-slate-700 ring-1 ring-white/10"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] text-white font-bold">
                                {initial}
                              </div>
                            )}
                            <span className="text-[13px] text-slate-300 font-medium">
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

      {/* ===== MODAL PREVIEW MEDIA ===== */}
      {previewMedia &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => setPreviewMedia(null)}
          >
            <div
              className="relative max-w-full max-h-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewMedia(null)}
                className="absolute -top-11 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              {previewMedia.type.startsWith("image/") ? (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.name}
                  className="max-w-[90vw] max-h-[82vh] object-contain rounded-xl shadow-2xl"
                />
              ) : previewMedia.type.startsWith("video/") ? (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  className="max-w-[90vw] max-h-[82vh] rounded-xl shadow-2xl"
                />
              ) : null}

              <a
                href={previewMedia.url}
                download={previewMedia.name}
                className="mt-3 text-xs text-slate-300 hover:text-emerald-400 transition-colors"
              >
                {t("chat_download_file", { name: previewMedia.name })}
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

      {/* ===== DANH SÁCH TIN NHẮN (đã gom nhóm) ===== */}
      <div
        ref={scrollContainerRef}
        className="flex-1 pt-3 overflow-y-auto pr-1.5 space-y-3 mb-3 custom-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            {t("chat_empty_state")}
          </div>
        ) : (
          messageGroups.map((group) => {
            const isMe = group.senderIdentity === localParticipant?.identity;
            const { displayName: realtimeSenderName } = getParticipantDetails(
              group.senderIdentity,
              group.senderName,
            );

            return (
              <div
                key={group.messages[0].id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {/* Tên + giờ chỉ hiện 1 lần đầu nhóm */}
                <div className="flex items-center gap-1.5 mb-1 px-0.5">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {isMe ? t("you_text") : realtimeSenderName}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(group.messages[0].timestamp).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </span>
                </div>

                {/* Các tin trong nhóm */}
                <div
                  className={`flex flex-col gap-1 w-full max-w-[92%] ${
                    isMe ? "items-end" : "items-start"
                  }`}
                >
                  {group.messages.map((msg, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === group.messages.length - 1;

                    // Bo góc theo vị trí trong nhóm
                    const bubbleRadius = isMe
                      ? `rounded-2xl ${isFirst ? "rounded-tr-md" : "rounded-tr-lg"} ${isLast ? "" : "rounded-br-lg"}`
                      : `rounded-2xl ${isFirst ? "rounded-tl-md" : "rounded-tl-lg"} ${isLast ? "" : "rounded-bl-lg"}`;

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
                        className={`group relative flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        {/* Menu hover */}
                        <div
                          className={`absolute -top-9 ${
                            isMe ? "right-1" : "left-1"
                          } opacity-0 group-hover:opacity-100 transition-opacity bg-[#1c1c1e]/95 border border-white/10 backdrop-blur-md rounded-xl shadow-xl flex items-center p-0.5 z-20 gap-0.5`}
                        >
                          <button
                            onClick={() => setReplyingTo(msg)}
                            title={t("chat_reply_button_title")}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Reply size={14} />
                          </button>
                          <div className="w-px h-3.5 bg-white/10 mx-0.5" />
                          {QUICK_EMOJIS.map((emj) => (
                            <button
                              key={emj}
                              onClick={() => handleReact(msg.id, emj)}
                              className="px-1 py-0.5 text-sm hover:scale-125 transition-transform"
                            >
                              {emj}
                            </button>
                          ))}
                        </div>

                        {/* Reply quote */}
                        {msg.replyToMsgId && (
                          <div
                            className={`text-[11px] px-2.5 py-1 mb-0.5 rounded-lg border-l-2 max-w-full line-clamp-2 ${
                              isMe
                                ? "border-emerald-400/60 bg-emerald-900/25 text-emerald-100/90"
                                : "border-slate-500 bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <span className="font-semibold block text-[10px] opacity-80">
                              {realtimeReplySenderName}
                            </span>
                            <span className="opacity-90">
                              {msg.replyToContent}
                            </span>
                          </div>
                        )}

                        {/* Ảnh / Video */}
                        {msg.publicUrl &&
                          (msg.fileType?.startsWith("image/") ||
                            msg.fileType?.startsWith("video/")) && (
                            <div
                              className="cursor-pointer overflow-hidden rounded-xl relative group/media shadow-sm max-w-full"
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
                                  className="max-w-full max-h-44 object-contain transition-transform duration-300 group-hover/media:scale-[1.02]"
                                />
                              ) : (
                                <video
                                  src={msg.publicUrl}
                                  className="max-w-full max-h-44 object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/25 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover/media:opacity-100 text-white bg-black/60 px-2.5 py-1 rounded-md text-[11px] font-medium backdrop-blur-sm">
                                  {t("chat_zoom")}
                                </span>
                              </div>
                            </div>
                          )}

                        {/* File khác */}
                        {msg.publicUrl &&
                          !msg.fileType?.startsWith("image/") &&
                          !msg.fileType?.startsWith("video/") && (
                            <a
                              href={msg.publicUrl}
                              download={msg.fileName}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors bg-[#1c1c1e] border border-white/10 hover:bg-white/5 shadow-sm max-w-full"
                            >
                              <FileText
                                size={16}
                                className={
                                  isMe ? "text-emerald-400" : "text-sky-400"
                                }
                              />
                              <span className="truncate text-[13px] font-medium text-slate-200 underline underline-offset-2">
                                {msg.fileName}
                              </span>
                            </a>
                          )}

                        {/* Text bubble */}
                        {msg.content && (
                          <div
                            className={`px-3 py-1.5 text-[13px] leading-relaxed shadow-sm ${bubbleRadius} ${
                              isMe
                                ? "bg-emerald-600 text-white"
                                : "bg-[#2a2a2e] text-slate-100"
                            }`}
                          >
                            <p className="whitespace-pre-wrap wrap-break-words">
                              {msg.content}
                            </p>
                          </div>
                        )}

                        {/* Reactions */}
                        {msg.reactions &&
                          Object.values(msg.reactions).some(
                            (users) => users.length > 0,
                          ) && (
                            <div
                              className={`flex flex-wrap gap-1 mt-0.5 ${
                                isMe ? "justify-end" : "justify-start"
                              }`}
                            >
                              {Object.entries(msg.reactions).map(
                                ([emoji, users]) => {
                                  if (users.length === 0) return null;
                                  const hasReacted = users.includes(
                                    localParticipant?.identity || "",
                                  );
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReact(msg.id, emoji)}
                                      className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ring-1 transition-colors ${
                                        hasReacted
                                          ? "bg-emerald-900/40 ring-emerald-500/50 text-emerald-300"
                                          : "bg-[#1c1c1e] ring-white/10 text-slate-400 hover:bg-white/5"
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="font-medium">
                                        {users.length}
                                      </span>
                                    </button>
                                  );
                                },
                              )}
                              <button
                                onClick={() =>
                                  setReactionDetails(msg.reactions!)
                                }
                                title={t("chat_view_reactions_title")}
                                className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-full transition-colors"
                              >
                                <Info size={11} />
                              </button>
                            </div>
                          )}

                        {/* Private indicator */}
                        {msg.isPrivate && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-500/70">
                            <Lock size={9} />
                            <span>
                              {isMe
                                ? t("chat_private_to", {
                                    name: msg.targetIdentity
                                      ? (getParticipantDetails(
                                          msg.targetIdentity,
                                          msg.targetName,
                                        ).displayName ?? "")
                                      : (msg.targetName ?? ""),
                                  })
                                : t("chat_private_to_you")}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===== VÙNG NHẬP (đã thu gọn) ===== */}
      <div className="shrink-0 flex flex-col gap-1.5 relative">
        {/* Overlay khi chat bị khóa */}
        {!canChat && (
          <div className="absolute inset-0 z-10 bg-[#0a0a0a]/70 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-xl pointer-events-none border border-white/5">
            <div className="bg-[#1c1c1e] text-slate-300 px-3.5 py-1.5 rounded-lg flex items-center gap-2 text-xs shadow-lg border border-white/10">
              <Lock size={13} className="text-rose-400" />
              {t("chat_locked")}
            </div>
          </div>
        )}

        {/* Banner đang trả lời */}
        {replyingTo && (
          <div className="bg-[#1c1c1e] border border-white/10 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-300 flex justify-between items-center">
            <div className="truncate pr-2">
              <span className="font-semibold text-emerald-400 mr-1">
                {t("chat_replying_to", { name: replyingTo.senderName })}
              </span>
              {replyingTo.content ||
                (replyingTo.fileName
                  ? t("chat_reply_file", { name: replyingTo.fileName })
                  : t("chat_reply_media"))}
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-0.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Select đối tượng + Form nhập gộp gọn */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <select
              value={selectedTarget}
              disabled={!canChat}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full appearance-none text-[11px] pl-2.5 pr-7 py-2 rounded-lg border bg-[#1c1c1e] text-slate-300 border-white/10 focus:outline-none focus:border-emerald-500/40 cursor-pointer transition-colors"
            >
              <option value="all">{t("chat_target_all")}</option>
              {otherParticipants.map((p) => (
                <option key={p.identity} value={p.identity}>
                  {t("chat_target_specific", { name: p.name || "" })}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <ChevronDown size={12} />
            </div>
          </div>

          <form
            onSubmit={handleSendMessage}
            className="relative flex items-center rounded-xl border bg-[#1c1c1e] border-white/10 px-1 py-0.5 focus-within:border-emerald-500/40 transition-colors"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canChat}
              className="p-1.5 text-slate-400 hover:text-emerald-400 disabled:opacity-40 transition-colors shrink-0"
            >
              <Paperclip size={16} />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={!canChat}
              placeholder={
                canChat
                  ? t("chat_input_placeholder")
                  : t("chat_input_placeholder_locked")
              }
              className="flex-1 bg-transparent text-[13px] text-slate-200 px-1.5 py-1.5 focus:outline-none min-w-0 placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || !canChat}
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:bg-slate-700 ml-0.5 transition-colors shrink-0"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        <p className="text-[10px] text-slate-600 text-center leading-tight">
          {t("chat_input_hint")}
        </p>
      </div>
    </div>
  );
}
