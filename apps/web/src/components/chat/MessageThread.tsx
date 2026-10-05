"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  DirectConversationResponse,
  DirectMessageResponse,
  ChatAttachment,
} from "@/types/chat";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import {
  ArrowLeft,
  Info,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface MessageThreadProps {
  conversation: DirectConversationResponse;
  currentUserId?: string;
  messages: DirectMessageResponse[];
  hasMore: boolean;
  isLoadingMessages?: boolean;
  isLoadingMore?: boolean;
  isRecipientTyping?: boolean;
  onLoadMore: () => void;
  onSendMessage: (payload: {
    content?: string;
    type?: "text" | "file" | "video" | "image";
    attachments?: ChatAttachment[];
    replyToId?: string;
  }) => Promise<void>;
  onReactMessage: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onTyping: (isTyping: boolean) => void;
  onBackMobile?: () => void;
  onToggleDetails?: () => void;
  showDetails?: boolean;
}

function formatDateSeparator(dateStr: string, t: (key: any) => string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return t("today");

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return t("yesterday");

    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function MessageThread({
  conversation,
  currentUserId,
  messages,
  hasMore,
  isLoadingMessages,
  isLoadingMore,
  isRecipientTyping,
  onLoadMore,
  onSendMessage,
  onReactMessage,
  onDeleteMessage,
  onTyping,
  onBackMobile,
  onToggleDetails,
  showDetails,
}: MessageThreadProps) {
  const t = useTranslations("direct_chat");
  const [replyTo, setReplyTo] = useState<DirectMessageResponse | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on first load and on new message if close to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [conversation.id, scrollToBottom]);

  useEffect(() => {
    // Only smooth scroll if user is near bottom
    const container = scrollContainerRef.current;
    if (container) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom) {
        scrollToBottom(true);
      }
    }
  }, [messages.length, scrollToBottom]);

  // Track scroll position for infinite scroll & floating scroll button
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if scrolled up
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    setShowScrollBottom(!isNearBottom);

    // Infinite scroll up
    if (container.scrollTop < 60 && hasMore && !isLoadingMore) {
      onLoadMore();
    }
  };

  const { recipient } = conversation;
  const isOnline = recipient?.status === "ACTIVE";

  // Group messages by day for date dividers
  let lastDateStr = "";

  return (
    <div className="flex-1 h-full flex flex-col bg-[#fcfcfc] overflow-hidden relative">
      {/* ── Thread Header ── */}
      <div className="h-16 px-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          {/* Back button for mobile */}
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 mr-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Recipient Avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600 shadow-xs">
              {recipient?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipient.avatarUrl}
                  alt={recipient.displayName || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                recipient?.displayName?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isOnline ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
          </div>

          {/* Recipient Name and Status */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight">
              {recipient?.displayName || t("user_fallback")}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {isOnline ? t("online") : t("offline")}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          {onToggleDetails && (
            <button
              onClick={onToggleDetails}
              className={`p-2 rounded-xl transition-colors ${
                showDetails
                  ? "bg-brand-50 text-brand-600"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
              title={t("details")}
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Messages Scroll Area ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-4 space-y-2"
      >
        {/* Load more spinner */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          </div>
        )}

        {/* Loading messages initial */}
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <span className="text-xs">{t("loading_messages")}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
            <p className="text-sm font-medium text-slate-600 mb-1">
              {t("no_messages")}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const dateStr = formatDateSeparator(msg.createdAt, t);
            const showDate = dateStr !== lastDateStr;
            if (showDate) {
              lastDateStr = dateStr;
            }

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 rounded-full bg-slate-200/70 text-slate-500 text-[11px] font-semibold tracking-wide">
                      {dateStr}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  currentUserId={currentUserId}
                  onReply={(m) => setReplyTo(m)}
                  onReact={onReactMessage}
                  onDelete={onDeleteMessage}
                />
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator */}
        {isRecipientTyping && (
          <TypingIndicator
            displayName={recipient?.displayName}
            avatarUrl={recipient?.avatarUrl}
          />
        )}

        <div ref={bottomAnchorRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 right-6 p-2 rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:text-brand-600 hover:bg-slate-50 transition-all z-20"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* ── Input Area ── */}
      <MessageInput
        conversationId={conversation.id}
        onSendMessage={onSendMessage}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={onTyping}
      />
    </div>
  );
}
