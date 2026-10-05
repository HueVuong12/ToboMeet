"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useGetConversationsQuery,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useCreateOrGetConversationMutation,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useReactMessageMutation,
  useDeleteMessageMutation,
} from "@/lib/redux/api/directChatApi";
import { useGetMeQuery } from "@/lib/redux/api/usersApi";
import { useChatSocket } from "@/hooks/useChatSocket";
import {
  DirectConversationResponse,
  DirectMessageResponse,
  ChatAttachment,
} from "@/types/chat";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import ConversationDetailsDrawer from "./ConversationDetailsDrawer";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function ChatLayout() {
  const t = useTranslations("direct_chat");
  const { data: currentUser } = useGetMeQuery();
  const currentUserId = currentUser?.supabaseId;

  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
  } = useGetConversationsQuery();

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [localMessages, setLocalMessages] = useState<DirectMessageResponse[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConvId);

  // RTK Query Mutations
  const [createOrGetConversation] = useCreateOrGetConversationMutation();
  const [sendMessage] = useSendMessageMutation();
  const [markAsRead] = useMarkAsReadMutation();
  const [reactMessage] = useReactMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [fetchMoreMessages] = useLazyGetMessagesQuery();

  // Load messages for selected conversation
  const {
    data: initialMessagesData,
    isLoading: isLoadingMessages,
  } = useGetMessagesQuery(
    { conversationId: selectedConvId!, limit: 30 },
    { skip: !selectedConvId },
  );

  // Sync initial messages to local state
  useEffect(() => {
    if (initialMessagesData) {
      setLocalMessages(initialMessagesData.messages || []);
      setHasMore(initialMessagesData.hasMore || false);
    } else {
      setLocalMessages([]);
      setHasMore(false);
    }
  }, [initialMessagesData, selectedConvId]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (selectedConvId && activeConversation && activeConversation.unreadCount > 0) {
      markAsRead(selectedConvId).catch(() => {});
    }
  }, [selectedConvId, activeConversation, markAsRead]);

  // Socket handlers
  const handleSocketNewMessage = useCallback(
    (newMsg: DirectMessageResponse) => {
      setLocalMessages((prev) => {
        // Tránh trùng tin nhắn nếu đã có
        if (prev.some((m) => m.id === newMsg.id || (m._id && m._id === newMsg._id))) {
          return prev;
        }
        return [...prev, newMsg];
      });

      // Tự động đánh dấu đã đọc nếu đang mở đúng conversation này
      if (selectedConvId && newMsg.conversationId === selectedConvId) {
        markAsRead(selectedConvId).catch(() => {});
      }
    },
    [selectedConvId, markAsRead],
  );

  const handleSocketReactionUpdated = useCallback(
    (data: { messageId: string; reactions: any[] }) => {
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId || msg._id === data.messageId
            ? { ...msg, reactions: data.reactions }
            : msg,
        ),
      );
    },
    [],
  );

  const handleSocketMessageDeleted = useCallback(
    (data: { messageId: string; conversationId: string }) => {
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId || msg._id === data.messageId
            ? {
                ...msg,
                deletedAt: new Date().toISOString(),
                content: t("message_deleted"),
                attachments: [],
              }
            : msg,
        ),
      );
    },
    [t],
  );

  const { isRecipientTyping, emitTyping } = useChatSocket({
    conversationId: selectedConvId,
    currentUserId,
    onNewMessage: handleSocketNewMessage,
    onReactionUpdated: handleSocketReactionUpdated,
    onMessageDeleted: handleSocketMessageDeleted,
  });

  // Action: Load more messages (older)
  const handleLoadMore = async () => {
    if (!selectedConvId || !hasMore || isLoadingMore || localMessages.length === 0) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const oldestId = localMessages[0].id || localMessages[0]._id;
      const res = await fetchMoreMessages({
        conversationId: selectedConvId,
        before: oldestId,
        limit: 30,
      }).unwrap();

      if (res && res.messages) {
        setLocalMessages((prev) => [...res.messages, ...prev]);
        setHasMore(res.hasMore);
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Action: Send message
  const handleSendMessage = async (payload: {
    content?: string;
    type?: "text" | "file" | "video" | "image";
    attachments?: ChatAttachment[];
    replyToId?: string;
  }) => {
    if (!selectedConvId) return;

    const res = await sendMessage({
      conversationId: selectedConvId,
      ...payload,
    }).unwrap();

    if (res) {
      setLocalMessages((prev) => {
        if (prev.some((m) => m.id === res.id || (m._id && m._id === res._id))) {
          return prev;
        }
        return [...prev, res];
      });
    }
  };

  // Action: React to message
  const handleReactMessage = async (messageId: string, emoji: string) => {
    // Optimistic update: áp dụng logic duy nhất 1 reaction ngay lập tức
    if (currentUserId) {
      setLocalMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId && msg._id !== messageId) return msg;

          const reactions = (msg.reactions || []).map((r) => ({
            emoji: r.emoji,
            userIds: [...(r.userIds || [])],
          }));

          let wasSameEmoji = false;
          for (let i = reactions.length - 1; i >= 0; i--) {
            const r = reactions[i];
            const uIdx = r.userIds.indexOf(currentUserId);
            if (uIdx > -1) {
              if (r.emoji === emoji) {
                wasSameEmoji = true;
              }
              r.userIds.splice(uIdx, 1);
              if (r.userIds.length === 0) {
                reactions.splice(i, 1);
              }
            }
          }

          if (!wasSameEmoji) {
            const targetIndex = reactions.findIndex((r) => r.emoji === emoji);
            if (targetIndex > -1) {
              reactions[targetIndex].userIds.push(currentUserId);
            } else {
              reactions.push({ emoji, userIds: [currentUserId] });
            }
          }

          const cleanReactions = reactions.filter(
            (r) => r.userIds && r.userIds.length > 0,
          );

          return { ...msg, reactions: cleanReactions };
        }),
      );
    }

    try {
      await reactMessage({ messageId, emoji }).unwrap();
    } catch (err) {
      console.error("React error:", err);
    }
  };

  // Action: Delete/Recall message
  const handleDeleteMessage = async (messageId: string) => {
    // Optimistic update trên máy người gửi
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId || msg._id === messageId
          ? {
              ...msg,
              deletedAt: new Date().toISOString(),
              content: t("message_deleted"),
              attachments: [],
            }
          : msg,
      ),
    );

    try {
      await deleteMessage(messageId).unwrap();
      toast.success(t("delete_success"));
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(t("delete_failed"));
    }
  };

  // Action: Select user from search modal to start chat
  const handleSelectUser = async (user: any) => {
    const targetUserId = user.supabaseId || user._id;
    if (!targetUserId) return;

    try {
      const conv = await createOrGetConversation({
        recipientId: targetUserId,
      }).unwrap();

      setSelectedConvId(conv.id);
    } catch (err: any) {
      console.error("Create conversation error:", err);
      toast.error(err?.data?.message || t("create_conversation_failed"));
    }
  };

  return (
    <div className="h-full w-full flex overflow-hidden bg-white">
      {/* ── Column 1: Conversations List ── */}
      <div
        className={`h-full shrink-0 ${
          selectedConvId ? "hidden md:flex" : "flex w-full md:w-auto"
        }`}
      >
        <ConversationList
          conversations={conversations}
          selectedId={selectedConvId}
          currentUserId={currentUserId}
          onSelect={(c) => setSelectedConvId(c.id)}
          onSelectUser={handleSelectUser}
          isLoading={isLoadingConversations}
        />
      </div>

      {/* ── Column 2: Message Thread Area ── */}
      <div
        className={`flex-1 h-full min-w-0 flex flex-col ${
          !selectedConvId ? "hidden md:flex bg-slate-50/40" : "flex"
        }`}
      >
        {activeConversation ? (
          <MessageThread
            conversation={activeConversation}
            currentUserId={currentUserId}
            messages={localMessages}
            hasMore={hasMore}
            isLoadingMessages={isLoadingMessages}
            isLoadingMore={isLoadingMore}
            isRecipientTyping={isRecipientTyping}
            onLoadMore={handleLoadMore}
            onSendMessage={handleSendMessage}
            onReactMessage={handleReactMessage}
            onDeleteMessage={handleDeleteMessage}
            onTyping={emitTyping}
            onBackMobile={() => setSelectedConvId(null)}
            onToggleDetails={() => setShowDetails(!showDetails)}
            showDetails={showDetails}
          />
        ) : (
          <div className="flex-1 h-full w-full bg-slate-50/40" />
        )}
      </div>

      {/* ── Column 3: Conversation Details Drawer (Collapsible) ── */}
      {activeConversation && showDetails && (
        <ConversationDetailsDrawer
          conversation={activeConversation}
          messages={localMessages}
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
