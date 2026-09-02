import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useToggleCommentReactionMutation,
  CommentDto,
} from "../../lib/redux/features/newsFeed/newsFeedApi";
import { REACTION_ICONS } from "./ReactionPicker";
import { renderFormattedText } from "../../utils/markdownParser";

interface CommentNode extends CommentDto {
  children: CommentNode[];
  replyToAuthor?: { displayName?: string };
}

interface ThreadedCommentItemMobileProps {
  comment: CommentNode;
  level: number;
  currentUserId?: string;
  replyToId: string | null;
  replyText: string;
  isSubmitting: boolean;
  onSetReplyToId: (id: string | null) => void;
  onSetReplyText: (text: string) => void;
  onSendReply: (parentId: string) => void;
  onDelete: (commentId: string) => void;
  formatTimeAgo: (dateStr: string) => string;
  t: any;
}

function ThreadedCommentItemMobile({
  comment,
  level,
  currentUserId,
  replyToId,
  replyText,
  isSubmitting,
  onSetReplyToId,
  onSetReplyText,
  onSendReply,
  onDelete,
  formatTimeAgo,
  t,
}: ThreadedCommentItemMobileProps) {
  const isAuthor = comment.authorId === currentUserId;
  const isReplying = replyToId === comment._id;
  // Giới hạn thụt lề tối đa ở level 2 hoặc 3 trên mobile để không làm hẹp thẻ bình luận
  const indentStyle =
    level > 0
      ? level <= 2
        ? "pl-3 border-l border-slate-200 mt-2.5"
        : "pl-1.5 border-l border-slate-200 mt-2"
      : "mt-3";

  return (
    <View className={indentStyle}>
      <View className="flex-row items-start gap-2">
        {level > 0 && (
          <Feather
            name="corner-down-right"
            size={12}
            color="#94A3B8"
            style={{ marginTop: 6 }}
          />
        )}
        <View
          className={`${
            level > 0 ? "w-7 h-7" : "w-8 h-8"
          } rounded-full bg-slate-100 justify-center items-center border border-slate-200`}
        >
          <Text
            className={`font-bold text-slate-700 ${
              level > 0 ? "text-[10px]" : "text-xs"
            }`}
          >
            {comment.author?.displayName
              ? comment.author.displayName.charAt(0).toUpperCase()
              : "U"}
          </Text>
        </View>

        <View className="flex-1">
          <View className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="font-bold text-slate-800 text-xs">
                {comment.author?.displayName || "User"}
              </Text>
              {comment.author?.role === "owner" && (
                <View className="bg-amber-100 px-1.5 py-0.5 rounded">
                  <Text className="text-[9px] font-bold text-amber-700">
                    {t("news_feed.owner")}
                  </Text>
                </View>
              )}
              {comment.author?.role === "admin" && (
                <View className="bg-blue-100 px-1.5 py-0.5 rounded">
                  <Text className="text-[9px] font-bold text-blue-700">
                    Admin
                  </Text>
                </View>
              )}
              <Text className="text-[10px] text-slate-400">
                {formatTimeAgo(comment.createdAt)}
              </Text>
            </View>

            <View className="mt-1">
              {comment.replyToAuthor?.displayName && (
                <Text className="text-[#0052FF] font-bold text-xs">
                  @{comment.replyToAuthor.displayName}{" "}
                </Text>
              )}
              <Text className="text-sm text-slate-700 leading-relaxed">
                {renderFormattedText(comment.content)}
              </Text>
            </View>
          </View>

          {/* Comment Actions: Trả lời & Xóa cho MỌI CẤP */}
          <View className="flex-row items-center gap-4 mt-1 ml-2">
            <TouchableOpacity
              onPress={() => {
                if (isReplying) {
                  onSetReplyToId(null);
                } else {
                  onSetReplyToId(comment._id);
                  onSetReplyText("");
                }
              }}
            >
              <Text className="text-xs font-semibold text-slate-500">
                {t("news_feed.reply")}
              </Text>
            </TouchableOpacity>

            {isAuthor && (
              <TouchableOpacity onPress={() => onDelete(comment._id)}>
                <Text className="text-xs font-semibold text-red-500">
                  {t("news_feed.delete")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Reply Input */}
          {isReplying && (
            <View className="flex-row items-center gap-2 mt-2">
              <View className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 flex-row items-center">
                <Text className="text-[10px] font-bold text-[#0052FF] mr-1">
                  @{comment.author?.displayName || "User"}
                </Text>
                <TextInput
                  value={replyText}
                  onChangeText={onSetReplyText}
                  placeholder={t("news_feed.reply_placeholder")}
                  placeholderTextColor="#94A3B8"
                  autoFocus
                  className="flex-1 text-xs text-slate-800"
                />
                <TouchableOpacity
                  onPress={() => onSendReply(comment._id)}
                  disabled={isSubmitting || !replyText.trim()}
                  className="ml-1 w-6 h-6 rounded-full bg-[#0052FF] justify-center items-center"
                  style={{ opacity: replyText.trim() ? 1 : 0.4 }}
                >
                  <Feather name="send" size={11} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => onSetReplyToId(null)}
                className="px-2 py-1 bg-slate-100 rounded-full"
              >
                <Text className="text-xs text-slate-500 font-semibold">
                  {t("news_feed.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Đệ quy con cháu nhiều cấp */}
      {comment.children && comment.children.length > 0 && (
        <View className="space-y-1">
          {comment.children.map((child) => (
            <ThreadedCommentItemMobile
              key={child._id}
              comment={child}
              level={level + 1}
              currentUserId={currentUserId}
              replyToId={replyToId}
              replyText={replyText}
              isSubmitting={isSubmitting}
              onSetReplyToId={onSetReplyToId}
              onSetReplyText={onSetReplyText}
              onSendReply={onSendReply}
              onDelete={onDelete}
              formatTimeAgo={formatTimeAgo}
              t={t}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface CommentSectionModalProps {
  visible: boolean;
  postId: string;
  currentUserId?: string;
  onClose: () => void;
}

export default function CommentSectionModal({
  visible,
  postId,
  currentUserId,
  onClose,
}: CommentSectionModalProps) {
  const { t } = useTranslation();
  const { data: comments = [], isLoading } = useGetCommentsQuery(postId, {
    skip: !postId || !visible,
  });
  const [createComment, { isLoading: isSubmitting }] = useCreateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [toggleReaction] = useToggleCommentReactionMutation();

  const [commentText, setCommentText] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffMs < 0 || diffSec < 60) return t("news_feed.just_now");
    if (diffMin < 60) return t("news_feed.minutes_ago", { count: diffMin });
    if (diffHr < 24) return t("news_feed.hours_ago", { count: diffHr });

    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateFormatted = date.toLocaleDateString();
    return `${time} ${dateFormatted}`;
  };

  const handleSendComment = async (parentId?: string | null) => {
    const text = parentId ? replyText : commentText;
    if (!text.trim() || !postId) return;
    try {
      await createComment({
        postId,
        parentId: parentId || undefined,
        content: text.trim(),
      }).unwrap();

      if (parentId) {
        setReplyText("");
        setReplyToId(null);
      } else {
        setCommentText("");
      }
    } catch (err) {
      Alert.alert(t("room.error"), t("news_feed.send_comment_error"));
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert(t("news_feed.confirm_delete_title"), t("news_feed.confirm_delete_comment"), [
      { text: t("news_feed.cancel"), style: "cancel" },
      {
        text: t("news_feed.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment({ commentId, postId }).unwrap();
          } catch (err) {
            Alert.alert(t("room.error"), t("news_feed.delete_comment_error"));
          }
        },
      },
    ]);
  };

  const handleReaction = async (commentId: string, type: string) => {
    try {
      await toggleReaction({ commentId, postId, type }).unwrap();
    } catch (err) {
      console.log("Reaction error:", err);
    }
  };

  if (!visible) return null;

  // Xây dựng cây bình luận đa cấp (Threaded Comment Tree)
  const commentTree = useMemo(() => {
    const map = new Map<string, CommentNode>();
    const roots: CommentNode[] = [];

    comments.forEach((c) => {
      map.set(c._id, { ...c, children: [] });
    });

    comments.forEach((c) => {
      const node = map.get(c._id)!;
      if (c.parentId && map.has(c.parentId)) {
        const parent = map.get(c.parentId)!;
        node.replyToAuthor = parent.author;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [comments]);

  return (
    <View className="pt-3 border-t border-slate-100 bg-white">

        {/* Comment list */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="small" color="#0052FF" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {commentTree.length === 0 ? (
              <View className="items-center py-10">
                <Feather name="message-square" size={32} color="#94A3B8" />
                <Text className="text-slate-400 text-sm mt-2">
                  {t("news_feed.no_comments")}
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
                {commentTree.map((comment: CommentNode) => (
                  <ThreadedCommentItemMobile
                    key={comment._id}
                    comment={comment}
                    level={0}
                    currentUserId={currentUserId}
                    replyToId={replyToId}
                    replyText={replyText}
                    isSubmitting={isSubmitting}
                    onSetReplyToId={setReplyToId}
                    onSetReplyText={setReplyText}
                    onSendReply={handleSendComment}
                    onDelete={handleDelete}
                    formatTimeAgo={formatTimeAgo}
                    t={t}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Input Bar */}
        <View className="pt-2 border-t border-slate-100 bg-white">
          <View className="bg-slate-50 border border-slate-200 rounded-full px-4 py-2 flex-row items-center">
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder={t("news_feed.post_placeholder")}
              placeholderTextColor="#94A3B8"
              className="flex-1 text-xs text-slate-800 max-h-24"
              multiline
            />
            <TouchableOpacity
              onPress={() => handleSendComment(null)}
              disabled={isSubmitting || !commentText.trim()}
              className="ml-2 w-7 h-7 rounded-full bg-[#0052FF] justify-center items-center"
              style={{ opacity: commentText.trim() ? 1 : 0.4 }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={12} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
    </View>
  );
}
