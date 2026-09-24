import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AssignmentCommentItem } from "./types";

interface MemberCommentsModalProps {
  visible: boolean;
  onClose: () => void;
  member: any | null;
  comments: AssignmentCommentItem[];
  currentUserId: string;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
}

export default function MemberCommentsModal({
  visible,
  onClose,
  member,
  comments,
  currentUserId,
  onAddComment,
  onDeleteComment,
}: MemberCommentsModalProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [pendingComments, setPendingComments] = useState<(AssignmentCommentItem & { isPending?: boolean })[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const windowHeight = Dimensions.get("window").height;

  // Khi danh sách comments chính thức cập nhật, tự động dọn dẹp các bình luận tạm
  useEffect(() => {
    if (pendingComments.length > 0) {
      setPendingComments((prev) =>
        prev.filter((p) => !comments.some((c) => c.content === p.content && (c.userId === p.userId || c.role === p.role)))
      );
    }
  }, [comments]);

  // Lắng nghe sự kiện bàn phím để tự động đẩy popup lên
  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      const height = e.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const onHide = () => {
      setKeyboardHeight(0);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  const allComments = [...comments, ...pendingComments];

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [visible, allComments.length]);

  if (!visible || !member) return null;

  const memberName =
    member.displayName ||
    member.name ||
    t("assignments.member_fallback", { defaultValue: "Thành viên" });
  const memberInitial = memberName.charAt(0).toUpperCase();

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticComment: any = {
      _id: tempId,
      assignmentId: "",
      memberId: member.userId || member.supabaseId || member._id,
      userId: currentUserId,
      userName: t("room.you", { defaultValue: "Bạn" }),
      role: "owner",
      content: trimmed,
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    // 1. Phản hồi tức thì 0ms: Clear input, đẩy comment tạm vào UI, cuộn xuống ngay
    setContent("");
    setPendingComments((prev) => [...prev, optimisticComment]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      setIsSubmitting(true);
      await onAddComment(trimmed);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (err) {
      // Hoàn tác nếu gửi thất bại: xóa comment tạm và trả lại chữ vào ô input
      setPendingComments((prev) => prev.filter((p) => p._id !== tempId));
      setContent(trimmed);
      console.error("[MemberCommentsModal] Error sending comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert(
      t("assignments.confirm_delete_comment_title", { defaultValue: "Xóa phản hồi" }),
      t("assignments.confirm_delete_comment_msg", {
        defaultValue: "Bạn có chắc chắn muốn xóa phản hồi này không?",
      }),
      [
        {
          text: t("assignments.cancel_btn", { defaultValue: "Hủy" }),
          style: "cancel",
        },
        {
          text: t("assignments.delete_comment_btn", { defaultValue: "Xóa" }),
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
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculatedMaxHeight =
    keyboardHeight > 0
      ? Math.max(windowHeight - keyboardHeight - 50, 260)
      : "85%";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-black/50 justify-end"
        style={{
          paddingBottom:
            keyboardHeight > 0 ? keyboardHeight : Math.max(insets.bottom, 0),
        }}
      >
        {/* Vùng backdrop chạm để ẩn bàn phím hoặc đóng modal */}
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1"
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              onClose();
            }
          }}
        />

        {/* Khung nội dung Modal popup */}
        <View
          className="bg-white rounded-t-3xl flex-col overflow-hidden shadow-2xl"
          style={{
            maxHeight: calculatedMaxHeight,
            minHeight: keyboardHeight > 0 ? 220 : "50%",
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <View className="flex-row items-center gap-3 flex-1 mr-2 min-w-0">
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center border border-blue-200 shrink-0">
                <Text className="font-bold text-[#0052FF] text-base">
                  {memberInitial}
                </Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  className="font-bold text-slate-900 text-sm"
                  numberOfLines={1}
                >
                  {memberName}
                </Text>
                <Text
                  className="text-xs text-slate-400 font-medium"
                  numberOfLines={1}
                >
                  {member.email ||
                    t("assignments.comments_label", {
                      count: allComments.length,
                      defaultValue: `Bình luận (${allComments.length})`,
                    })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Comment Messages List */}
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 p-4 bg-slate-50/30"
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {allComments.length === 0 ? (
              <View className="py-12 items-center justify-center px-4">
                <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mb-3">
                  <Feather name="message-square" size={24} color="#0052FF" />
                </View>
                <Text className="text-slate-600 font-semibold text-sm text-center mb-1">
                  {t("assignments.member_comments_title", {
                    name: memberName,
                    defaultValue: `Bình luận với ${memberName}`,
                  })}
                </Text>
                <Text className="text-slate-400 text-xs text-center">
                  {t("assignments.no_member_comments", {
                    defaultValue:
                      "Chưa có bình luận nào giữa bạn và thành viên này.",
                  })}
                </Text>
              </View>
            ) : (
              <View className="space-y-3">
                {allComments.map((comment, idx) => {
                  const isMine = comment.userId === currentUserId;
                  const isPending = (comment as any).isPending;
                  return (
                    <View
                      key={comment._id || `c-${idx}`}
                      className={
                        "max-w-[85%] rounded-2xl p-3 shadow-2xs " +
                        (isMine
                          ? "bg-[#0052FF] self-end rounded-tr-xs"
                          : "bg-white border border-slate-100 self-start rounded-tl-xs") +
                        (isPending ? " opacity-80" : "")
                      }
                    >
                      {/* Author row */}
                      <View className="flex-row items-center justify-between gap-2 mb-1">
                        <Text
                          className={
                            "text-[11px] font-bold " +
                            (isMine ? "text-blue-100" : "text-slate-700")
                          }
                        >
                          {isMine ? t("room.you", { defaultValue: "Bạn" }) : comment.userName}
                        </Text>
                        {isMine && onDeleteComment && comment._id && !isPending && (
                          <TouchableOpacity
                            onPress={() => handleDelete(comment._id!)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="p-0.5"
                          >
                            <Feather name="trash-2" size={12} color="#FCA5A5" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Content */}
                      <Text
                        className={
                          "text-xs leading-relaxed " +
                          (isMine ? "text-white font-medium" : "text-slate-800")
                        }
                      >
                        {comment.content}
                      </Text>

                      {/* Timestamp / Pending indicator */}
                      {isPending ? (
                        <View className="flex-row items-center gap-1 self-end mt-1">
                          <Feather name="clock" size={10} color="#BFDBFE" />
                          <Text className="text-[9px] text-blue-200">
                            {t("assignments.sending", { defaultValue: "Đang gửi..." })}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          className={
                            "text-[9px] mt-1.5 self-end " +
                            (isMine ? "text-blue-200" : "text-slate-400")
                          }
                        >
                          {formatDate(comment.createdAt)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View className="border-t border-slate-100 p-3 bg-white flex-row items-center gap-2">
            <TextInput
              value={content}
              onChangeText={setContent}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 150);
              }}
              placeholder={t("assignments.write_reply", {
                defaultValue: "Viết bình luận...",
              })}
              placeholderTextColor="#94A3B8"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 max-h-24"
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!content.trim() || isSubmitting}
              className={
                "w-10 h-10 rounded-xl items-center justify-center " +
                (content.trim() && !isSubmitting
                  ? "bg-[#0052FF] active:bg-blue-700"
                  : "bg-slate-100")
              }
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather
                  name="send"
                  size={16}
                  color={content.trim() ? "#ffffff" : "#94A3B8"}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
