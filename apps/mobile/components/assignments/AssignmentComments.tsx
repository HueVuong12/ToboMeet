import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { AssignmentCommentItem } from "./types";

interface AssignmentCommentsProps {
  comments: AssignmentCommentItem[];
  currentUserId: string;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function AssignmentComments({
  comments,
  currentUserId,
  onAddComment,
  onDeleteComment,
  isLoading = false,
}: AssignmentCommentsProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onAddComment(text.trim());
      setText("");
    } catch (e) {
      console.error("Add comment error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      t("assignments.confirm_delete_comment_title"),
      t("assignments.confirm_delete_comment_msg"),
      [
        { text: t("assignments.cancel_btn"), style: "cancel" },
        {
          text: t("assignments.delete_comment_btn"),
          style: "destructive",
          onPress: async () => {
            if (onDeleteComment) {
              await onDeleteComment(commentId);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs mb-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Feather name="message-square" size={18} color="#0052FF" />
        <Text className="font-bold text-slate-800 text-base">
          {t("assignments.comments_count", { count: comments.length })}
        </Text>
      </View>

      {/* List of comments */}
      {comments.length === 0 ? (
        <Text className="text-slate-400 text-sm py-3 text-center">
          {t("assignments.no_comments")}
        </Text>
      ) : (
        <View className="space-y-3 mb-4">
          {comments.map((comment, index) => {
            const isMine = comment.userId === currentUserId;
            return (
              <View
                key={comment._id || `comment-${index}`}
                className={`p-3 rounded-xl border ${
                  isMine
                    ? "bg-blue-50/60 border-blue-100 self-end w-[90%]"
                    : "bg-slate-50 border-slate-100 self-start w-[90%]"
                }`}
              >
                {/* Row 1: TÊN (trái) và BUTTON XÓA (phải) */}
                <View className="flex-row items-center justify-between mb-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-bold text-xs text-slate-800">
                      {comment.userName}
                    </Text>
                    {comment.role && comment.role !== "member" && (
                      <View className="bg-blue-100 px-1.5 py-0.5 rounded">
                        <Text className="text-[10px] font-bold text-blue-700 uppercase">
                          {comment.role === "owner" ? t("room.role_teacher") : comment.role}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isMine && onDeleteComment && comment._id && (
                    <TouchableOpacity
                      onPress={() => handleDeleteComment(comment._id!)}
                      className="p-1 -mr-1 rounded-md"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Row 2: THỜI GIAN */}
                <Text className="text-[10px] text-slate-400 mb-1">
                  {formatDate(comment.createdAt)}
                </Text>

                {/* Row 3: NỘI DUNG */}
                <Text className="text-sm text-slate-700 leading-relaxed">
                  {comment.content}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Input row */}
      <View className="flex-row items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
        <TextInput
          placeholder={t("assignments.write_reply")}
          value={text}
          onChangeText={setText}
          className="flex-1 text-sm text-slate-800 py-1.5 max-h-28"
          placeholderTextColor="#94A3B8"
          multiline
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || isSubmitting || isLoading}
          className={`w-9 h-9 rounded-lg items-center justify-center ${
            text.trim() && !isSubmitting
              ? "bg-[#0052FF] active:bg-blue-700"
              : "bg-slate-200"
          }`}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Feather name="send" size={16} color={text.trim() ? "#ffffff" : "#94A3B8"} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
