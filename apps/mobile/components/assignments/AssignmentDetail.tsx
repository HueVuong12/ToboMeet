import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Assignment, Submission, AssignmentCommentItem } from "./types";
import AssignmentSubmissionModal from "./AssignmentSubmissionModal";
import { useFileViewer } from "../../hooks/useFileViewer";
import FileViewerModal from "../common/FileViewerModal";

interface AssignmentDetailProps {
  assignment: Assignment;
  submission?: Submission | null;
  isTeacher: boolean;
  roomMembers: any[];
  comments: AssignmentCommentItem[];
  userId: string;
  onBack: () => void;
  onSubmit: (attachments: any[]) => Promise<void>;
  isSubmitting?: boolean;
  onGradeClick?: () => void;
  refetchSubmission?: () => void;
  onDeleteSubmission?: () => Promise<void>;
  onDeleteAssignment?: () => Promise<void>;
  onAddComment: (assignmentId: string, content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
}

export default function AssignmentDetail({
  assignment,
  submission,
  isTeacher,
  roomMembers,
  comments,
  userId,
  onBack,
  onSubmit,
  isSubmitting = false,
  onGradeClick,
  refetchSubmission,
  onDeleteSubmission,
  onDeleteAssignment,
  onAddComment,
  onDeleteComment,
}: AssignmentDetailProps) {
  const { t } = useTranslation();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { selectedFile, isVisible: isFileViewerVisible, openFile, closeFile } = useFileViewer();

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

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
  }, []);

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleDeleteCommentClick = (commentId: string) => {
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

  const handleSendInlineComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;
    try {
      setIsSubmittingComment(true);
      await onAddComment(assignment._id, commentText.trim());
      setCommentText("");
    } catch (e) {
      console.error("Add comment error:", e);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const now = new Date();
  const deadline = new Date(assignment.deadline);
  const isPastDeadline = now.getTime() > deadline.getTime();
  const isLocked = isPastDeadline && assignment.submissionPolicy === "lock_after_deadline";

  const getRemainingOrOverdueText = (deadlineStr?: string, submissionDateStr?: string) => {
    if (!deadlineStr) return { text: "-", isOverdue: false };
    const deadline = new Date(deadlineStr);
    const target = submissionDateStr ? new Date(submissionDateStr) : new Date();

    const diffMs = deadline.getTime() - target.getTime();
    const isOverdue = diffMs < 0;
    const absDiff = Math.abs(diffMs);

    const totalSeconds = Math.floor(absDiff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    const years = Math.floor(totalDays / 365);

    const remainingDays = totalDays % 365;
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;
    const remainingSeconds = totalSeconds % 60;

    const unitYear = t("assignments.unit_year", { defaultValue: "năm" });
    const unitDay = t("assignments.unit_day", { defaultValue: "ngày" });
    const unitHour = t("assignments.unit_hour", { defaultValue: "giờ" });
    const unitMinute = t("assignments.unit_minute", { defaultValue: "phút" });
    const unitSecond = t("assignments.unit_second", { defaultValue: "giây" });

    const parts: string[] = [];

    if (years > 0) {
      parts.push(`${years} ${unitYear}`);
      if (remainingDays > 0) parts.push(`${remainingDays} ${unitDay}`);
    } else if (totalDays > 0) {
      parts.push(`${totalDays} ${unitDay}`);
      if (remainingHours > 0) parts.push(`${remainingHours} ${unitHour}`);
    } else if (totalHours > 0) {
      parts.push(`${totalHours} ${unitHour}`);
      if (remainingMinutes > 0) parts.push(`${remainingMinutes} ${unitMinute}`);
      if (remainingSeconds > 0) parts.push(`${remainingSeconds} ${unitSecond}`);
    } else if (totalMinutes > 0) {
      parts.push(`${totalMinutes} ${unitMinute}`);
      if (remainingSeconds > 0) parts.push(`${remainingSeconds} ${unitSecond}`);
    } else {
      parts.push(`${totalSeconds} ${unitSecond}`);
    }

    const timeText = parts.join(" ");

    if (submissionDateStr) {
      if (isOverdue) {
        return { text: t("assignments.submitted_late_text", { time: timeText }), isOverdue: true };
      } else {
        return { text: t("assignments.submitted_early_text", { time: timeText }), isOverdue: false };
      }
    } else {
      if (isOverdue) {
        return { text: t("assignments.overdue_by", { time: timeText }), isOverdue: true };
      } else {
        return { text: t("assignments.time_remaining_text", { time: timeText }), isOverdue: false };
      }
    }
  };

  const formatMobileDateTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const creatorName =
    (roomMembers && roomMembers.find((m) => (m.userId || m.supabaseId) === assignment.createdBy)?.displayName) ||
    assignment.creatorName ||
    "";

  const handleOpenAttachment = (att: { name: string; url: string; size?: number; type?: string }) => {
    openFile(att);
  };

  const handleConfirmDeleteSubmission = () => {
    Alert.alert(
      t("assignments.confirm_delete_submission_title"),
      t("assignments.confirm_delete_submission_desc"),
      [
        { text: t("assignments.cancel_btn"), style: "cancel" },
        {
          text: t("assignments.confirm_delete_btn"),
          style: "destructive",
          onPress: async () => {
            if (onDeleteSubmission) {
              await onDeleteSubmission();
            }
          },
        },
      ]
    );
  };

  const handleConfirmDeleteAssignment = () => {
    Alert.alert(
      t("files.confirm_delete_title", { defaultValue: "Xác nhận xóa nhiệm vụ" }),
      t("files.confirm_delete_msg", { defaultValue: "Bạn có chắc chắn muốn xóa nhiệm vụ này khỏi hệ thống không?", name: assignment.title }),
      [
        { text: t("assignments.cancel_btn"), style: "cancel" },
        {
          text: t("files.btn_delete", { defaultValue: "Xóa" }),
          style: "destructive",
          onPress: async () => {
            if (onDeleteAssignment) {
              await onDeleteAssignment();
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Navigation */}
      <View className="flex-row items-center justify-between px-4 py-3.5 bg-white border-b border-slate-100">
        <TouchableOpacity onPress={onBack} className="flex-row items-center gap-2">
          <Feather name="arrow-left" size={20} color="#475569" />
          <Text className="font-bold text-slate-800 text-base" numberOfLines={1}>
            {t("assignments.title")}
          </Text>
        </TouchableOpacity>

        {isTeacher && (
          <View className="flex-row items-center gap-2">
            {onGradeClick && (
              <TouchableOpacity
                onPress={onGradeClick}
                className="flex-row items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl active:bg-blue-100"
              >
                <Feather name="check-square" size={16} color="#0052FF" />
                <Text className="font-bold text-blue-600 text-xs">{t("assignments.teacher_grading_title")}</Text>
              </TouchableOpacity>
            )}
            {onDeleteAssignment && (
              <TouchableOpacity
                onPress={handleConfirmDeleteAssignment}
                className="p-2 rounded-xl bg-red-50 border border-red-100 active:bg-red-100"
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 36 : 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Details Card */}
        <View className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs mb-4">
          {!!creatorName && (
            <View className="flex-row items-center justify-end mb-3 gap-1">
              <Feather name="user" size={12} color="#94A3B8" />
              <Text className="text-xs text-slate-400 font-medium">
                {creatorName}
              </Text>
            </View>
          )}

          <Text className="font-bold text-slate-900 text-lg mb-3">
            {assignment.title}
          </Text>

          {/* Start & End Times (2 separate lines) */}
          <View className="py-3 border-y border-slate-100 mb-4 gap-1.5">
            <View className="flex-row items-start gap-1 flex-wrap">
              <Text className="text-xs font-bold text-slate-700">{t("assignments.time_start")} </Text>
              <Text className="text-xs text-slate-600 font-medium">
                {formatMobileDateTime(assignment.createdAt)}
              </Text>
            </View>

            <View className="flex-row items-start gap-1 flex-wrap">
              <Text className="text-xs font-bold text-slate-700">{t("assignments.time_end")} </Text>
              <Text className="text-xs text-slate-600 font-medium">
                {formatMobileDateTime(assignment.deadline)}
              </Text>
            </View>
          </View>

          {/* Description */}
          {!!(assignment.description && assignment.description.trim() !== "") && (
            <View className="mb-4">
              <Text className="font-bold text-slate-800 text-sm mb-1">{t("assignments.field_desc")}</Text>
              <Text className="text-sm text-slate-700 leading-relaxed">
                {assignment.description}
              </Text>
            </View>
          )}

          {/* Attachments */}
          {assignment.attachments && assignment.attachments.length > 0 && (
            <View className="mt-2 pt-3 border-t border-slate-100">
              <Text className="font-bold text-slate-800 text-xs mb-2 uppercase">
                {t("assignments.attachments_title", { count: assignment.attachments.length })}
              </Text>
              {assignment.attachments.map((att, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleOpenAttachment(att)}
                  className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2"
                >
                  <Feather name="file-text" size={18} color="#0052FF" />
                  <Text
                    className="font-semibold text-slate-700 text-xs ml-3 flex-1"
                    numberOfLines={1}
                  >
                    {att.name}
                  </Text>
                  <Feather name="download" size={16} color="#64748B" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Student Submission Action (Non-teachers only) */}
        {!isTeacher && (
          <View className="mb-4">
            {submission ? (
              <View className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs text-slate-500 font-medium">
                    {t("assignments.submitted_at", { time: formatDate(submission.submittedAt) })}
                  </Text>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      submission.score !== undefined
                        ? "bg-purple-100"
                        : submission.submissionStatus === "late"
                        ? "bg-amber-100"
                        : "bg-emerald-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        submission.score !== undefined
                          ? "text-purple-700"
                          : submission.submissionStatus === "late"
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {submission.score !== undefined
                        ? t("assignments.graded_status_text", { score: submission.score, maxScore: assignment.maxScore || 10 })
                        : submission.submissionStatus === "late"
                        ? t("assignments.late_status_text")
                        : t("assignments.submitted_status_text")}
                    </Text>
                  </View>
                </View>

                {submission.attachments?.map((att, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleOpenAttachment(att)}
                    className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2"
                  >
                    <Feather name="file" size={16} color="#0052FF" />
                    <Text
                      className="font-semibold text-slate-700 text-xs ml-2 flex-1"
                      numberOfLines={1}
                    >
                      {att.name}
                    </Text>
                    <Feather name="external-link" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                ))}

                {submission.feedback ? (
                  <View className="mt-3 bg-purple-50 border border-purple-200 p-3 rounded-xl">
                    <Text className="font-bold text-purple-900 text-xs mb-1">
                      {t("assignments.teacher_feedback")}
                    </Text>
                    <Text className="text-xs text-purple-800">
                      {submission.feedback}
                    </Text>
                  </View>
                ) : null}

                {!isLocked && submission.score === undefined && (
                  <View className="flex-row gap-2 mt-4">
                    <TouchableOpacity
                      onPress={handleConfirmDeleteSubmission}
                      className="flex-1 py-3 rounded-xl bg-red-50 border border-red-200 items-center"
                    >
                      <Text className="font-bold text-red-600 text-xs">{t("assignments.remove_submission")}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setShowSubmitModal(true)}
                      className="flex-1 py-3 rounded-xl bg-[#0052FF] active:bg-blue-700 items-center"
                    >
                      <Text className="font-bold text-white text-xs">{t("assignments.update_submission")}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : isLocked ? (
              <View className="bg-red-50 border border-red-200 p-3.5 rounded-xl w-full flex-row items-center gap-2">
                <Feather name="lock" size={18} color="#EF4444" />
                <Text className="text-xs text-red-700 font-bold flex-1 leading-relaxed">
                  {t("assignments.locked_notice")}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowSubmitModal(true)}
                className="w-full py-3.5 rounded-xl bg-[#0052FF] active:bg-blue-700 items-center flex-row justify-center gap-2"
              >
                <Feather name="upload" size={18} color="#ffffff" />
                <Text className="font-bold text-white text-sm">{t("assignments.add_submission")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Trạng thái nhiệm vụ Card */}
        <View className="bg-white rounded-2xl border border-slate-100 shadow-xs mb-4 overflow-hidden">
          <View className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <Text className="font-bold text-slate-800 text-sm">{t("assignments.task_status_card")}</Text>
          </View>

          {/* Row 1: Trạng thái nhiệm vụ */}
          <View className="flex-row border-b border-slate-100 min-h-[44px]">
            <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
              <Text className="text-xs font-bold text-slate-700">{t("assignments.task_status_row")}</Text>
            </View>
            <View className="w-7/12 p-3.5 justify-center">
              {submission ? (
                <View className="self-start px-2.5 py-0.5 bg-blue-50 border border-blue-100 rounded-md">
                  <Text className="text-xs font-semibold text-blue-700">{t("assignments.submitted_for_grading")}</Text>
                </View>
              ) : (
                <Text className="text-xs text-slate-500 font-medium">{t("assignments.no_submission_yet")}</Text>
              )}
            </View>
          </View>

          {/* Row 2: Trạng thái đánh giá */}
          <View className="flex-row border-b border-slate-100 min-h-[44px]">
            <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
              <Text className="text-xs font-bold text-slate-700">{t("assignments.grade_status_row")}</Text>
            </View>
            <View className="w-7/12 p-3.5 justify-center">
              {submission?.score !== undefined ? (
                <View className="self-start px-2.5 py-0.5 bg-purple-50 border border-purple-100 rounded-md">
                  <Text className="text-xs font-semibold text-purple-700">
                    {t("assignments.graded_score_info", { score: submission.score, maxScore: assignment.maxScore || 10 })}
                  </Text>
                </View>
              ) : (
                <Text className="text-xs text-slate-500 font-medium">{t("assignments.not_graded_yet")}</Text>
              )}
            </View>
          </View>

          {/* Row 3: Thời gian còn lại */}
          <View className="flex-row border-b border-slate-100 min-h-[44px]">
            <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
              <Text className="text-xs font-bold text-slate-700">{t("assignments.time_remaining_row")}</Text>
            </View>
            <View className="w-7/12 p-3.5 justify-center">
              {(() => {
                const timeInfo = getRemainingOrOverdueText(
                  assignment.deadline,
                  submission?.submittedAt
                );
                return (
                  <Text
                    className={`text-xs ${
                      timeInfo.isOverdue
                        ? "text-red-600 font-bold"
                        : "text-slate-700 font-medium"
                    }`}
                  >
                    {timeInfo.text}
                  </Text>
                );
              })()}
            </View>
          </View>

          {/* Row 4: Đăng tải các bình luận */}
          <View className="flex-row min-h-[44px]">
            <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-start pt-3.5">
              <Text className="text-xs font-bold text-slate-700">{t("assignments.comments_row")}</Text>
            </View>
            <View className="w-7/12 p-3.5 justify-center">
              <TouchableOpacity
                onPress={() => setIsCommentsExpanded(!isCommentsExpanded)}
                className="flex-row items-center gap-1"
              >
                <Feather
                  name={isCommentsExpanded ? "chevron-down" : "chevron-right"}
                  size={14}
                  color="#0052FF"
                />
                <Text className="text-xs text-[#0052FF] font-semibold">
                  {t("assignments.comments_count", { count: comments.length })}
                </Text>
              </TouchableOpacity>

              {isCommentsExpanded && (
                <View className="mt-3 border-t border-slate-100 pt-3 gap-2.5">
                  {/* List of comments */}
                  {comments.length === 0 ? (
                    <Text className="text-slate-400 text-xs py-1 italic">
                      {t("assignments.no_comments")}
                    </Text>
                  ) : (
                    <View className="gap-2">
                      {comments.map((comment, index) => (
                        <View
                          key={comment._id || `comment-${index}`}
                          className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl gap-1"
                        >
                          {/* Row 1: TÊN (trái) và BUTTON XÓA (phải) */}
                          <View className="flex-row items-center justify-between">
                            <Text className="font-bold text-xs text-slate-800">
                              {comment.userName}
                            </Text>
                            {comment.userId === userId && onDeleteComment && (
                              <TouchableOpacity
                                onPress={() => handleDeleteCommentClick(comment._id)}
                                className="p-1 -mr-1 rounded-md"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="trash-2" size={13} color="#EF4444" />
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* Row 2: THỜI GIAN */}
                          <Text className="text-[10px] text-slate-400 -mt-0.5">
                            {formatMobileDateTime(comment.createdAt)}
                          </Text>

                          {/* Row 3: NỘI DUNG */}
                          <Text className="text-xs text-slate-700 leading-relaxed mt-1">
                            {comment.content}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Input form */}
                  <View className="flex-row items-center gap-2 mt-1">
                    <TextInput
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder={t("assignments.write_reply")}
                      placeholderTextColor="#94A3B8"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 max-h-28"
                      multiline
                      onFocus={handleInputFocus}
                      onContentSizeChange={() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }}
                    />
                    <TouchableOpacity
                      onPress={handleSendInlineComment}
                      disabled={!commentText.trim() || isSubmittingComment}
                      className={`px-3 py-2.5 rounded-xl items-center justify-center ${
                        commentText.trim() && !isSubmittingComment
                          ? "bg-[#0052FF] active:bg-blue-700"
                          : "bg-slate-200"
                      }`}
                    >
                      {isSubmittingComment ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text
                          className={`font-bold text-xs ${
                            commentText.trim() ? "text-white" : "text-slate-400"
                          }`}
                        >
                          {t("assignments.send_btn")}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Submission Upload Modal */}
      {showSubmitModal && (
        <AssignmentSubmissionModal
          visible={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          roomId={assignment.roomId}
          channelId={assignment.channelId}
          existingSubmission={submission}
          onSubmit={async (atts) => {
            await onSubmit(atts);
            setShowSubmitModal(false);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* File Viewer Modal */}
      <FileViewerModal
        visible={isFileViewerVisible}
        file={selectedFile}
        onClose={closeFile}
      />
    </View>
  );
}
