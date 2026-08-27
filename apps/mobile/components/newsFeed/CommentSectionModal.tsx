import React, { useState } from "react";
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

  // Root Comments (parentId === null)
  const rootComments = comments.filter((c) => !c.parentId);

  // Replies map
  const repliesMap = comments.reduce((acc, curr) => {
    if (curr.parentId) {
      acc[curr.parentId] = acc[curr.parentId] || [];
      acc[curr.parentId].push(curr);
    }
    return acc;
  }, {} as Record<string, CommentDto[]>);

  return (
    <View className="pt-3 border-t border-slate-100 bg-white">

        {/* Comment list */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="small" color="#0052FF" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {rootComments.length === 0 ? (
              <View className="items-center py-10">
                <Feather name="message-square" size={32} color="#94A3B8" />
                <Text className="text-slate-400 text-sm mt-2">
                  {t("news_feed.no_comments")}
                </Text>
              </View>
            ) : (
              rootComments.map((comment: CommentDto) => {
                const commentReplies = repliesMap[comment._id] || [];
                const isAuthor = comment.authorId === currentUserId;
                const userReaction = comment.reactions?.find(
                  (r: { userId: string; type: string }) => r.userId === currentUserId
                )?.type;

                return (
                  <View key={comment._id} className="mb-5">
                    {/* Parent Comment */}
                    <View className="flex-row items-start gap-2.5">
                      <View className="w-8 h-8 rounded-full bg-slate-100 justify-center items-center border border-slate-200">
                        <Text className="font-bold text-slate-700 text-xs">
                          {comment.author?.displayName
                            ? comment.author.displayName.charAt(0).toUpperCase()
                            : "U"}
                        </Text>
                      </View>

                      <View className="flex-1">
                        <View className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                          <View className="flex-row items-center gap-2">
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
                            <Text className="text-[10px] text-slate-400">
                              {formatTimeAgo(comment.createdAt)}
                            </Text>
                          </View>
                          <Text className="text-sm text-slate-700 mt-1 leading-relaxed">
                            {renderFormattedText(comment.content)}
                          </Text>
                        </View>

                        {/* Comment Action Links (Trả lời / Xóa) */}
                        <View className="flex-row items-center gap-4 mt-1 ml-2">
                          <TouchableOpacity
                            onPress={() => {
                              setReplyToId(comment._id);
                              setReplyText("");
                            }}
                          >
                            <Text className="text-xs font-semibold text-slate-500">
                              {t("news_feed.reply")}
                            </Text>
                          </TouchableOpacity>

                          {isAuthor && (
                            <TouchableOpacity onPress={() => handleDelete(comment._id)}>
                              <Text className="text-xs font-semibold text-red-500">
                                {t("news_feed.delete")}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Nested Replies List */}
                    {commentReplies.map((reply: CommentDto) => {
                      const isReplyAuthor = reply.authorId === currentUserId;
                      return (
                        <View
                          key={reply._id}
                          className="flex-row items-start gap-2 pl-8 mt-3"
                        >
                          <View className="w-7 h-7 rounded-full bg-slate-100 justify-center items-center border border-slate-200">
                            <Text className="font-bold text-slate-600 text-[10px]">
                              {reply.author?.displayName
                                ? reply.author.displayName.charAt(0).toUpperCase()
                                : "U"}
                            </Text>
                          </View>

                          <View className="flex-1">
                            <View className="bg-slate-50/80 border border-slate-100 rounded-2xl p-2.5">
                              <View className="flex-row items-center gap-1.5">
                                <Text className="font-bold text-slate-800 text-xs">
                                  {reply.author?.displayName || "User"}
                                </Text>
                                {reply.author?.role === "owner" && (
                                  <View className="bg-amber-100 px-1 py-0.5 rounded">
                                    <Text className="text-[8px] font-bold text-amber-700">
                                      {t("news_feed.owner")}
                                    </Text>
                                  </View>
                                )}
                                <Text className="text-[10px] text-slate-400">
                                  {formatTimeAgo(reply.createdAt)}
                                </Text>
                              </View>
                              <Text className="text-xs text-slate-700 mt-0.5">
                                {reply.content}
                              </Text>
                            </View>
                            {isReplyAuthor && (
                              <TouchableOpacity
                                onPress={() => handleDelete(reply._id)}
                                className="mt-1 ml-2"
                              >
                                <Text className="text-[11px] font-semibold text-red-500">
                                  {t("news_feed.delete")}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    {/* Inline Reply Input Box */}
                    {replyToId === comment._id && (
                      <View className="flex-row items-center gap-2 pl-8 mt-2">
                        <View className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 flex-row items-center">
                          <TextInput
                            value={replyText}
                            onChangeText={setReplyText}
                            placeholder={t("news_feed.reply_placeholder")}
                            placeholderTextColor="#94A3B8"
                            className="flex-1 text-xs text-slate-800"
                          />
                          <TouchableOpacity
                            onPress={() => handleSendComment(comment._id)}
                            disabled={isSubmitting || !replyText.trim()}
                            className="ml-1 w-6 h-6 rounded-full bg-[#0052FF] justify-center items-center"
                            style={{ opacity: replyText.trim() ? 1 : 0.4 }}
                          >
                            <Feather name="send" size={11} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          onPress={() => setReplyToId(null)}
                          className="px-2 py-1 bg-slate-100 rounded-full"
                        >
                          <Text className="text-xs text-slate-500 font-semibold">
                            {t("news_feed.cancel")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
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
