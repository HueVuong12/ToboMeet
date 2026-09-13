import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Assignment, Submission, AssignmentCommentItem } from "./types";
import AssignmentSubmissionModal from "./AssignmentSubmissionModal";
import { useFileViewer } from "../../hooks/useFileViewer";
import FileViewerModal from "../common/FileViewerModal";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { axiosInstance } from "../../lib/axios";
import { calculateSubmissionTiming } from "./utils/submissionTimeHelper";
import { downloadAssignmentExcel } from "./utils/excelExport";
import CreateTaskModal from "./CreateTaskModal";
import MemberCommentsModal from "./MemberCommentsModal";
import { socket } from "../../lib/socket";

interface AssignmentDetailProps {
  assignment: Assignment;
  submission?: Submission | null;
  submissions?: Submission[];
  isTeacher: boolean;
  roomMembers: any[];
  comments: AssignmentCommentItem[];
  userId: string;
  onBack: () => void;
  onSubmit: (attachments: any[]) => Promise<void>;
  isSubmitting?: boolean;
  onGradeClick?: () => void;
  onGradeSubmission?: (
    submissionId: string,
    score: number | undefined,
    feedback: string
  ) => Promise<void>;
  onEditAssignment?: () => void;
  refetchSubmission?: () => void;
  onDeleteSubmission?: () => Promise<void>;
  onDeleteAssignment?: () => Promise<void>;
  onAddComment: (assignmentId: string, content: string, memberId?: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
  onCreateClick?: () => void;
  onCreateQuizClick?: () => void;
}

export default function AssignmentDetail({
  assignment,
  submission,
  submissions = [],
  isTeacher,
  roomMembers,
  comments,
  userId,
  onBack,
  onSubmit,
  isSubmitting = false,
  onGradeClick,
  onGradeSubmission,
  onEditAssignment,
  refetchSubmission,
  onDeleteSubmission,
  onDeleteAssignment,
  onAddComment,
  onDeleteComment,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  onCreateClick,
  onCreateQuizClick,
}: AssignmentDetailProps) {
  const { t, i18n } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [downloadingAttName, setDownloadingAttName] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [memberTab, setMemberTab] = useState<"need_return" | "returned">("need_return");
  const [memberSearch, setMemberSearch] = useState("");
  const [gradeModal, setGradeModal] = useState<{ member: any; submission: Submission | null } | null>(null);
  const [activeCommentMember, setActiveCommentMember] = useState<any | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const scrollViewRef = React.useRef<ScrollView>(null);
  const { selectedFile, isVisible: isFileViewerVisible, openFile, closeFile } = useFileViewer();

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: any) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    };
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const handleInputFocus = () => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const refetchSubmissionRef = React.useRef(refetchSubmission);
  useEffect(() => {
    refetchSubmissionRef.current = refetchSubmission;
  }, [refetchSubmission]);

  // Realtime updates qua socket cho chấm điểm, hủy nộp và nộp bài
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleAssignmentGraded = (data: any) => {
      const eventAssignId = String(data?.submission?.assignmentId || data?.assignmentId || "");
      if ((eventAssignId === String(assignment._id) || String(data?.roomId) === String(assignment.roomId)) && refetchSubmissionRef.current) {
        try {
          refetchSubmissionRef.current();
        } catch (e) {}
      }
    };

    const handleSubmissionDeleted = (data: any) => {
      const eventAssignId = String(data?.assignmentId || data?.submission?.assignmentId || "");
      if ((eventAssignId === String(assignment._id) || String(data?.roomId) === String(assignment.roomId)) && refetchSubmissionRef.current) {
        try {
          refetchSubmissionRef.current();
        } catch (e) {}
      }
    };

    const handleAssignmentSubmitted = (data: any) => {
      const eventAssignId = String(data?.submission?.assignmentId || data?.assignmentId || "");
      if ((eventAssignId === String(assignment._id) || String(data?.roomId) === String(assignment.roomId)) && refetchSubmissionRef.current) {
        try {
          refetchSubmissionRef.current();
        } catch (e) {}
      }
    };

    socket.on("assignment_graded", handleAssignmentGraded);
    socket.on("assignment_submission_deleted", handleSubmissionDeleted);
    socket.on("assignment_submitted", handleAssignmentSubmitted);

    return () => {
      socket.off("assignment_graded", handleAssignmentGraded);
      socket.off("assignment_submission_deleted", handleSubmissionDeleted);
      socket.off("assignment_submitted", handleAssignmentSubmitted);
    };
  }, [assignment._id, assignment.roomId]);

  const now = new Date();
  const deadline = new Date(assignment.deadline);
  const isPastDeadline = now.getTime() > deadline.getTime();
  const isLocked = isPastDeadline && assignment.submissionPolicy === "lock_after_deadline";

  const pad = (n: number) => String(n).padStart(2, "0");

  const formatDeadline24h = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMobileDateTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const formatLMSDate = (dateStr?: string | Date) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const isEn = i18n.language && i18n.language.startsWith("en");
    const weekdaysVi = [
      "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"
    ];
    const weekdaysEn = [
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];
    const monthsVi = [
      "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
      "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ];
    const monthsEn = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const weekday = isEn ? weekdaysEn[d.getDay()] : weekdaysVi[d.getDay()];
    const day = d.getDate();
    const month = isEn ? monthsEn[d.getMonth()] : monthsVi[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes} ${ampm}`;

    return `${weekday}, ${day} ${month} ${year}, ${timeStr}`;
  };

  const formatScoreDisplay = (score?: number, maxScore?: number) => {
    const isEn = i18n.language && i18n.language.startsWith("en");
    const locale = isEn ? "en-US" : "vi-VN";
    const formattedScore = (score ?? 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedMax = (maxScore ?? assignment.maxScore ?? 10).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formattedScore} / ${formattedMax}`;
  };

  const getRemainingOrOverdueText = (deadlineStr?: string, submissionDateStr?: string) => {
    if (!deadlineStr) return { text: "—", isOverdue: false };
    const dl = new Date(deadlineStr);
    const target = submissionDateStr ? new Date(submissionDateStr) : new Date();
    const diffMs = dl.getTime() - target.getTime();
    const isOverdue = diffMs < 0;
    const absDiff = Math.abs(diffMs);
    const totalSeconds = Math.floor(absDiff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    const years = Math.floor(totalDays / 365);
    const unitYear = t("assignments.unit_year", { defaultValue: "năm" });
    const unitDay = t("assignments.unit_day", { defaultValue: "ngày" });
    const unitHour = t("assignments.unit_hour", { defaultValue: "giờ" });
    const unitMinute = t("assignments.unit_minute", { defaultValue: "phút" });
    const unitSecond = t("assignments.unit_second", { defaultValue: "giây" });
    const parts: string[] = [];
    if (years > 0) {
      parts.push(`${years} ${unitYear}`);
      if (totalDays % 365 > 0) parts.push(`${totalDays % 365} ${unitDay}`);
    } else if (totalDays > 0) {
      parts.push(`${totalDays} ${unitDay}`);
      if (totalHours % 24 > 0) parts.push(`${totalHours % 24} ${unitHour}`);
    } else if (totalHours > 0) {
      parts.push(`${totalHours} ${unitHour}`);
      if (totalMinutes % 60 > 0) parts.push(`${totalMinutes % 60} ${unitMinute}`);
    } else if (totalMinutes > 0) {
      parts.push(`${totalMinutes} ${unitMinute}`);
      if (totalSeconds % 60 > 0) parts.push(`${totalSeconds % 60} ${unitSecond}`);
    } else {
      parts.push(`${totalSeconds} ${unitSecond}`);
    }
    const timeText = parts.join(" ");
    if (submissionDateStr) {
      return isOverdue
        ? {
            text: t("assignments.submitted_late_text", {
              time: timeText,
              defaultValue: `Nộp muộn ${timeText}`,
            }),
            isOverdue: true,
          }
        : {
            text: t("assignments.submitted_early_text", {
              time: timeText,
              defaultValue: `Nộp sớm ${timeText}`,
            }),
            isOverdue: false,
          };
    }
    return isOverdue
      ? {
          text: t("assignments.overdue_by", {
            time: timeText,
            defaultValue: `Đã quá hạn ${timeText}`,
          }),
          isOverdue: true,
        }
      : {
          text: t("assignments.time_remaining_text", {
            time: timeText,
            defaultValue: `Còn lại ${timeText}`,
          }),
          isOverdue: false,
        };
  };

  const handleDeleteCommentClick = (commentId: string) => {
    Alert.alert(
      t("assignments.confirm_delete_comment_title", { defaultValue: "Xác nhận xóa phản hồi" }),
      t("assignments.confirm_delete_comment_msg", { defaultValue: "Bạn có chắc chắn muốn xóa phản hồi này?" }),
      [
        { text: t("assignments.cancel_btn", { defaultValue: "Hủy" }), style: "cancel" },
        {
          text: t("assignments.delete_comment_btn", { defaultValue: "Xóa" }),
          style: "destructive",
          onPress: async () => {
            if (onDeleteComment) await onDeleteComment(commentId);
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

  const handleConfirmDeleteSubmission = () => {
    Alert.alert(
      t("assignments.confirm_delete_submission_title", { defaultValue: "Xác nhận xóa bài nộp" }),
      t("assignments.confirm_delete_submission_desc", { defaultValue: "Bạn có chắc chắn muốn hủy bài nộp này?" }),
      [
        { text: t("assignments.cancel_btn", { defaultValue: "Hủy" }), style: "cancel" },
        {
          text: t("assignments.confirm_delete_btn", { defaultValue: "Xóa bài nộp" }),
          style: "destructive",
          onPress: async () => {
            if (onDeleteSubmission) await onDeleteSubmission();
          },
        },
      ]
    );
  };

  const handleConfirmDeleteAssignment = () => {
    setShowMenu(false);
    Alert.alert(
      t("assignments.confirm_delete_assignment_title", { defaultValue: "Xác nhận xóa nhiệm vụ" }),
      t("assignments.confirm_delete_assignment_msg", { defaultValue: "Bạn có chắc chắn muốn xóa nhiệm vụ này không?" }),
      [
        { text: t("assignments.cancel_btn", { defaultValue: "Hủy" }), style: "cancel" },
        {
          text: t("assignments.delete_comment_btn", { defaultValue: "Xóa" }),
          style: "destructive",
          onPress: async () => {
            if (onDeleteAssignment) await onDeleteAssignment();
          },
        },
      ]
    );
  };

  const handleExportExcel = async () => {
    setShowMenu(false);
    if (isExporting) return;
    try {
      setIsExporting(true);
      await downloadAssignmentExcel(assignment._id, assignment.title);
    } catch (err: any) {
      Alert.alert(
        t("assignments.error_title", { defaultValue: "Lỗi" }),
        err?.message || t("assignments.export_excel_error", { defaultValue: "Không thể xuất file Excel" })
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAttachment = async (att: { name: string; url: string; size?: number; type?: string }) => {
    if (!att.url || downloadingAttName) return;
    setDownloadingAttName(att.name);
    try {
      const safeName = (att.name || "file_download").replace(/[^a-zA-Z0-9._-]/g, "_");
      const localUri = FileSystem.documentDirectory + safeName;
      const downloadResult = await FileSystem.downloadAsync(att.url, localUri);
      if (downloadResult.status !== 200) throw new Error(t("assignments.download_file_error", { defaultValue: "Không thể tải tập tin" }));

      if (Sharing && typeof Sharing.isAvailableAsync === "function") {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: att.type || "application/octet-stream",
            dialogTitle: att.name,
          });
          return;
        }
      }
      Alert.alert(
        t("assignments.notice_title", { defaultValue: "Thông báo" }),
        t("assignments.download_file_success", { name: att.name, defaultValue: `Đã tải tập tin: ${att.name}` })
      );
    } catch (err: any) {
      Alert.alert(
        t("assignments.error_title", { defaultValue: "Lỗi" }),
        err?.message || t("assignments.download_file_error", { defaultValue: "Không thể tải tập tin" })
      );
    } finally {
      setDownloadingAttName(null);
    }
  };

  const handleSaveGradeInModal = async () => {
    if (!gradeModal?.submission?._id || !onGradeSubmission) return;
    const isAlreadyGraded = gradeModal.submission.score !== undefined;
    const scoreNum = scoreInput.trim() === "" ? undefined : parseFloat(scoreInput);
    if (scoreNum !== undefined) {
      const maxScore = assignment.maxScore ?? 10;
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
        Alert.alert(
          t("assignments.error_title", { defaultValue: "Lỗi" }),
          t("assignments.error_score_invalid", { maxScore, defaultValue: `Điểm số phải từ 0 đến ${maxScore} điểm` })
        );
        return;
      }
    }
    try {
      setIsSavingGrade(true);
      await onGradeSubmission(gradeModal.submission._id, scoreNum, feedbackInput);
      setGradeModal(null);
      Alert.alert(
        t("assignments.success_title", { defaultValue: "Thành công" }),
        isAlreadyGraded
          ? t("assignments.update_grade_success", { defaultValue: "Đã cập nhật đánh giá thành công" })
          : t("assignments.save_grade_success", { defaultValue: "Đã lưu đánh giá thành công" })
      );
    } catch (err: any) {
      Alert.alert(
        t("assignments.error_title", { defaultValue: "Lỗi" }),
        err?.message || t("assignments.toast_error_generic", { defaultValue: "Đã xảy ra lỗi" })
      );
    } finally {
      setIsSavingGrade(false);
    }
  };

  const submissionsMap = new Map(submissions.map((s) => [s.studentId, s]));

  const assignedMembers = roomMembers.filter((member) => {
    if (["owner", "admin"].includes(member.role?.toLowerCase())) return false;
    if (assignment.recipientType === "specific_members" || assignment.recipientType === "current_members") {
      return assignment.recipientMemberIds?.includes(member.userId || member.supabaseId);
    }
    return true;
  });

  const filteredMembers = assignedMembers.filter((m) => {
    const uid = m.userId || m.supabaseId;
    const sub = submissionsMap.get(uid);
    if (memberSearch.trim()) {
      const name = (m.displayName || m.name || "").toLowerCase();
      const email = (m.email || "").toLowerCase();
      if (!name.includes(memberSearch.toLowerCase()) && !email.includes(memberSearch.toLowerCase())) {
        return false;
      }
    }
    if (memberTab === "need_return") {
      // Cần trả về: đã nộp chưa chấm + chưa nộp
      return !sub || sub.score === undefined;
    }
    // Đã trả về: đã có điểm
    return sub !== undefined && sub.score !== undefined;
  });

  const hasDescription = !!(assignment.description && assignment.description.trim() !== "");
  const hasAttachments = assignment.attachments && assignment.attachments.length > 0;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header Bar: Nhiệm vụ (Hình 2) */}
      <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {onOpenLeftDrawer ? (
            <TouchableOpacity onPress={onOpenLeftDrawer} className="p-1 mr-2">
              <Feather name="menu" size={24} color="#1E293B" />
            </TouchableOpacity>
          ) : (
            <View className="p-1 mr-2">
              <Feather name="menu" size={24} color="#1E293B" />
            </View>
          )}
          <View className="w-8 h-8 rounded-lg bg-blue-100 items-center justify-center mr-2.5">
            <Text className="font-bold text-[#0052FF] text-sm">T</Text>
          </View>
          <Text className="font-bold text-slate-900 text-lg">
            {t("assignments.title", { defaultValue: "Nhiệm vụ" })}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {isTeacher && onCreateClick && (
            <TouchableOpacity
              onPress={() => setIsCreateModalOpen(true)}
              className="flex-row items-center gap-1.5 bg-[#0052FF] active:bg-blue-700 px-3.5 py-2 rounded-xl shadow-xs"
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text className="font-bold text-white text-xs">
                {t("assignments.create_btn", { defaultValue: "Tạo nhiệm vụ" })}
              </Text>
            </TouchableOpacity>
          )}
          {onOpenRightDrawer ? (
            <TouchableOpacity
              onPress={onOpenRightDrawer}
              className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100"
            >
              <Feather name="info" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : (
            <View className="w-8 h-8 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
              <Feather name="info" size={16} color="#64748B" />
            </View>
          )}
        </View>
      </View>

      {/* Sub Header: Chi tiết nhiệm vụ (Hình 1) */}
      <View className="bg-white border-b border-slate-100 px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-1.5">
          <View className="flex-row items-center gap-2 flex-1 min-w-0 mr-2">
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="p-1 -ml-1"
            >
              <Feather name="arrow-left" size={20} color="#475569" />
            </TouchableOpacity>
            <Text className="font-bold text-slate-900 text-base flex-shrink" numberOfLines={1}>
              {isTeacher
                ? assignment.title
                : t("assignments.detail_title", { defaultValue: "Chi tiết nhiệm vụ" })}
            </Text>
            {isTeacher && assignment.gradingType === "graded" && assignment.maxScore !== undefined && (
              <View className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md shrink-0">
                <Text className="text-xs font-bold text-blue-700">
                  {t("assignments.points", {
                    points: assignment.maxScore,
                    defaultValue: `${assignment.maxScore} điểm`,
                  })}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-1.5 shrink-0">
            {isTeacher && (
              <>
                {onEditAssignment && (
                  <TouchableOpacity
                    onPress={onEditAssignment}
                    className="flex-row items-center gap-1 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl"
                  >
                    <Feather name="edit-3" size={14} color="#475569" />
                    <Text className="text-xs font-bold text-slate-700">
                      {t("assignments.edit_btn", { defaultValue: "Chỉnh sửa" })}
                    </Text>
                  </TouchableOpacity>
                )}
                <View>
                  <TouchableOpacity
                    onPress={() => setShowMenu(!showMenu)}
                    className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center"
                  >
                    <Feather name="more-vertical" size={16} color="#475569" />
                  </TouchableOpacity>
                  {showMenu && (
                    <View
                      className="absolute right-0 bg-white rounded-2xl border border-slate-100 py-1.5 z-50 w-52 shadow-lg"
                      style={{ top: 36, elevation: 12 }}
                    >
                      <TouchableOpacity
                        onPress={handleExportExcel}
                        disabled={isExporting}
                        className="flex-row items-center gap-3 px-4 py-3"
                      >
                        {isExporting ? (
                          <ActivityIndicator size="small" color="#0052FF" />
                        ) : (
                          <Feather name="download" size={16} color="#0052FF" />
                        )}
                        <Text className="text-sm font-medium text-slate-700">
                          {t("assignments.export_excel", { defaultValue: "Xuất ra Excel" })}
                        </Text>
                      </TouchableOpacity>
                      <View className="h-px bg-slate-100 mx-3" />
                      <TouchableOpacity
                        onPress={handleConfirmDeleteAssignment}
                        className="flex-row items-center gap-3 px-4 py-3"
                      >
                        <Feather name="trash-2" size={16} color="#EF4444" />
                        <Text className="text-sm font-medium text-red-600">
                          {t("assignments.delete_assignment", { defaultValue: "Xóa nhiệm vụ" })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {isTeacher && (
          <View className="flex-row items-center gap-1.5">
            <Feather name="calendar" size={13} color="#64748B" />
            <Text className="text-xs text-slate-500 font-medium">
              {t("assignments.due_at", {
                time: formatDeadline24h(assignment.deadline),
                defaultValue: `Đến hạn vào ${formatDeadline24h(assignment.deadline)}`,
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Collapsible description & attachments (Chỉ hiển thị cho Giáo viên) */}
      {isTeacher && (hasDescription || hasAttachments) && (
        <TouchableOpacity
          onPress={() => setIsDescExpanded(!isDescExpanded)}
          className="flex-row items-center gap-2 bg-white border-b border-slate-100 px-4 py-3"
          activeOpacity={0.7}
        >
          <Feather name="paperclip" size={14} color="#0052FF" />
          <Text className="text-xs font-semibold text-[#0052FF] flex-1">
            {t("assignments.view_desc_attachments", { defaultValue: "Xem mô tả & tài liệu đính kèm" })}
          </Text>
          <Feather
            name={isDescExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#0052FF"
          />
        </TouchableOpacity>
      )}

      {/* Backdrop for Menu */}
      {showMenu && (
        <TouchableOpacity
          onPress={() => setShowMenu(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
          }}
        />
      )}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 36 : 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* STUDENT VIEW: Title + Start & End Time Box (Hình 2) */}
        {!isTeacher && (
          <View className="mb-4">
            <Text className="font-bold text-slate-900 text-xl mb-3">
              {assignment.title}
            </Text>

            <View className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex-col gap-2">
              <View className="flex-row items-center flex-wrap">
                <Text className="text-xs font-bold text-slate-800">
                  {t("assignments.start_time", { defaultValue: "Thời gian bắt đầu" })}:{" "}
                </Text>
                <Text className="text-xs text-slate-600">
                  {formatLMSDate(assignment.createdAt)}
                </Text>
              </View>
              <View className="flex-row items-center flex-wrap">
                <Text className="text-xs font-bold text-slate-800">
                  {t("assignments.end_time", { defaultValue: "Thời gian kết thúc" })}:{" "}
                </Text>
                <Text className="text-xs text-slate-600">
                  {formatLMSDate(assignment.deadline)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Description & Attachments Box (Tự động hiển thị cho Thành viên, hoặc khi Giáo viên bấm mở rộng) */}
        {(!isTeacher || isDescExpanded) && (hasDescription || hasAttachments) && (
          <View className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs mb-4">
            {hasDescription && (
              <View className={hasAttachments ? "mb-3" : ""}>
                <Text className="font-bold text-slate-800 text-sm mb-1">
                  {t("assignments.field_desc", { defaultValue: "Mô tả nhiệm vụ" })}
                </Text>
                <Text className="text-sm text-slate-700 leading-relaxed">
                  {assignment.description}
                </Text>
              </View>
            )}

            {hasAttachments && (
              <View className={hasDescription ? "pt-3 border-t border-slate-100" : ""}>
                <Text className="font-bold text-slate-700 text-xs mb-2 uppercase">
                  {t("assignments.attachments_title_short", { defaultValue: "Tài liệu đính kèm" })}
                </Text>
                {assignment.attachments.map((att, idx) => {
                  const isDownloading = downloadingAttName === att.name;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleDownloadAttachment(att)}
                      disabled={isDownloading}
                      className="flex-row items-center bg-slate-50 border border-slate-200 active:bg-slate-100 rounded-xl p-3 mb-2"
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#0052FF" />
                      ) : (
                        <Feather name="file-text" size={18} color="#0052FF" />
                      )}
                      <Text
                        className="font-semibold text-slate-700 text-xs ml-3 flex-1"
                        numberOfLines={1}
                      >
                        {att.name}
                      </Text>
                      <Feather
                        name="download"
                        size={16}
                        color={isDownloading ? "#0052FF" : "#64748B"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* TEACHER VIEW: Cần trả về / Đã trả về & Member List */}
        {isTeacher && (
          <View className="bg-white rounded-2xl border border-slate-100 shadow-xs mb-4 overflow-hidden">
            {/* Tab selector & Member search */}
            <View className="flex-row items-center justify-between border-b border-slate-100 px-1">
              <View className="flex-row">
                {[
                  {
                    id: "need_return",
                    label: t("assignments.tab_need_return", { defaultValue: "Cần trả về" }),
                  },
                  {
                    id: "returned",
                    label: t("assignments.tab_returned", { defaultValue: "Đã trả về" }),
                  },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => {
                      setMemberTab(tab.id as any);
                      setMemberSearch("");
                    }}
                    className={
                      "py-3 px-4 border-b-2 " +
                      (memberTab === tab.id
                        ? "border-[#0052FF]"
                        : "border-transparent")
                    }
                  >
                    <Text
                      className={
                        "text-xs font-bold " +
                        (memberTab === tab.id
                          ? "text-[#0052FF]"
                          : "text-slate-500")
                      }
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View
                className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 mr-2 flex-1 ml-2"
                style={{ maxWidth: 150 }}
              >
                <Feather name="search" size={12} color="#94A3B8" />
                <TextInput
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder={t("assignments.search_member_placeholder", {
                    defaultValue: "Tìm thành viên...",
                  })}
                  placeholderTextColor="#94A3B8"
                  className="ml-1.5 flex-1 text-xs text-slate-700 p-0"
                />
              </View>
            </View>

            {/* Member Table Header */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ minWidth: 560 }}>
                <View className="flex-row bg-slate-50/70 border-b border-slate-100 px-4 py-2.5 items-center">
                  <Text className="text-[11px] font-bold text-slate-500 uppercase flex-1 min-w-[140px]">
                    {t("assignments.col_name", { defaultValue: "Tên" })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-500 uppercase w-28 text-center">
                    {t("assignments.col_status", { defaultValue: "Trạng thái" })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-500 uppercase w-28 text-center">
                    {t("assignments.col_submitted_at", { defaultValue: "Thời gian nộp" })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-500 uppercase w-20 text-center">
                    {t("assignments.col_comments", { defaultValue: "Bình luận" })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-500 uppercase w-16 text-center">
                    {t("assignments.col_feedback", { defaultValue: "Nhận xét" })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-500 uppercase w-16 text-right pr-2">
                    {"/" + (assignment.maxScore ?? 10)}
                  </Text>
                </View>

                {/* Member Table Rows */}
                {filteredMembers.length === 0 ? (
                  <View className="py-12 items-center justify-center">
                    <Feather name="users" size={32} color="#CBD5E1" />
                    <Text className="text-slate-400 text-xs mt-2 font-medium">
                      {t("assignments.no_members", { defaultValue: "Không có thành viên" })}
                    </Text>
                  </View>
                ) : (
                  filteredMembers.map((member) => {
                    const uid = member.userId || member.supabaseId;
                    const sub = submissionsMap.get(uid);
                    const hasSubmitted = !!sub?.submittedAt;
                    const isGraded = sub?.score !== undefined;

                    return (
                      <TouchableOpacity
                        key={uid}
                        onPress={() => {
                          if (sub) {
                            setGradeModal({ member, submission: sub });
                            setScoreInput(
                              sub.score !== undefined ? String(sub.score) : ""
                            );
                            setFeedbackInput(sub.feedback || "");
                          } else {
                            Alert.alert(
                              member.displayName ||
                                member.name ||
                                t("assignments.member_fallback", {
                                  defaultValue: "Thành viên",
                                }),
                              t("assignments.unsubmitted_member_alert", {
                                defaultValue: "Thành viên chưa nộp nhiệm vụ.",
                              })
                            );
                          }
                        }}
                        className="flex-row items-center px-4 py-3 border-b border-slate-50 active:bg-slate-50"
                      >
                        {/* Avatar & Name */}
                        <View className="flex-row items-center flex-1 min-w-[140px] mr-2">
                          <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2.5 shrink-0">
                            <Text className="font-bold text-blue-600 text-sm">
                              {(member.displayName || member.name || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text
                              className="font-semibold text-slate-800 text-xs"
                              numberOfLines={1}
                            >
                              {member.displayName ||
                                member.name ||
                                t("assignments.member_fallback", {
                                  defaultValue: "Thành viên",
                                })}
                            </Text>
                            <Text
                              className="text-[10px] text-slate-400 font-medium"
                              numberOfLines={1}
                            >
                              {member.email || ""}
                            </Text>
                          </View>
                        </View>

                        {/* Status */}
                        <View className="w-28 items-center">
                          {hasSubmitted ? (
                            isGraded ? (
                              <View className="bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                                <Text className="text-[10px] font-bold text-purple-700">
                                  {t("assignments.status_returned", {
                                    defaultValue: "Đã trả về",
                                  })}
                                </Text>
                              </View>
                            ) : (
                              <View className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                                <Text className="text-[10px] font-bold text-blue-600">
                                  {t("assignments.status_submitted", {
                                    defaultValue: "Đã nộp để đánh giá",
                                  })}
                                </Text>
                              </View>
                            )
                          ) : (
                            <View className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              <Text className="text-[10px] font-medium text-slate-500">
                                {t("assignments.status_not_submitted", {
                                  defaultValue: "Chưa hoàn thành",
                                })}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Submission Time */}
                        <View className="w-28 items-center">
                          {(() => {
                            const timing = calculateSubmissionTiming(
                              sub?.submittedAt,
                              assignment.deadline,
                              t
                            );
                            if (timing.status === "not_submitted") {
                              return (
                                <Text className="text-[10px] text-slate-400 font-medium text-center">
                                  {t("assignments.timing_not_submitted", {
                                    defaultValue: "Chưa nộp",
                                  })}
                                </Text>
                              );
                            }
                            const isLate = timing.status === "late";
                            return (
                              <View
                                className={
                                  "px-2 py-0.5 rounded-md border " +
                                  (isLate
                                    ? "bg-amber-50 border-amber-200"
                                    : "bg-emerald-50 border-emerald-200")
                                }
                              >
                                <Text
                                  className={
                                    "text-[10px] font-semibold text-center " +
                                    (isLate ? "text-amber-700" : "text-emerald-700")
                                  }
                                >
                                  {timing.text}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>

                        {/* Comments column (Sau Thời gian nộp, trước Phản hồi) */}
                        <TouchableOpacity
                          onPress={() => setActiveCommentMember(member)}
                          className="w-20 items-center justify-center py-1"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {(() => {
                            const memberCommentsCount = (comments || []).filter(
                              (c: any) => (c.memberId || c.userId) === uid
                            ).length;

                            return (
                              <View className="flex-row items-center gap-1 px-2 py-1 rounded-lg">
                                <Feather
                                  name="message-square"
                                  size={15}
                                  color={memberCommentsCount > 0 ? "#0052FF" : "#CBD5E1"}
                                />
                                {memberCommentsCount > 0 && (
                                  <Text className="text-xs font-bold text-[#0052FF]">
                                    {memberCommentsCount}
                                  </Text>
                                )}
                              </View>
                            );
                          })()}
                        </TouchableOpacity>

                        {/* Feedback column */}
                        <View className="w-16 items-center">
                          {sub?.feedback ? (
                            <Feather name="message-square" size={14} color="#0052FF" />
                          ) : (
                            <Text className="text-slate-300 text-xs">—</Text>
                          )}
                        </View>

                        {/* Score column */}
                        <View className="w-16 items-end pr-2">
                          {isGraded ? (
                            <Text className="text-xs font-bold text-slate-800">
                              {sub!.score}
                            </Text>
                          ) : (
                            <Text className="text-slate-400 text-xs">—</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* STUDENT VIEW: Submission info & comments */}
        {!isTeacher && (() => {
          const hasActiveSubmission = !!(
            submission &&
            submission.submissionStatus !== "not_submitted" &&
            submission.submittedAt
          );

          return (
            <>
              <View className="mb-4">
                {hasActiveSubmission ? (
                  !isLocked ? (
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => setShowSubmitModal(true)}
                        className="flex-1 py-3.5 rounded-xl bg-[#0052FF] active:bg-blue-700 items-center justify-center shadow-xs"
                      >
                        <Text className="font-bold text-white text-xs">
                          {t("assignments.modal_edit_submission_title", { defaultValue: "Cập nhật nhiệm vụ" })}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleConfirmDeleteSubmission}
                        className="flex-1 py-3.5 rounded-xl bg-red-50 border border-red-200 active:bg-red-100 items-center justify-center"
                      >
                        <Text className="font-bold text-red-600 text-xs">
                          {t("assignments.remove_submission", { defaultValue: "Hủy nộp nhiệm vụ" })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="bg-red-50 border border-red-200 p-3.5 rounded-xl w-full flex-row items-center gap-2">
                      <Feather name="lock" size={18} color="#EF4444" />
                      <Text className="text-xs text-red-700 font-bold flex-1 leading-relaxed">
                        {t("assignments.locked_submission_notice", {
                          defaultValue: "Nhiệm vụ này đã khóa nộp bài sau thời hạn quy định.",
                        })}
                      </Text>
                    </View>
                  )
                ) : isLocked ? (
                  <View className="bg-red-50 border border-red-200 p-3.5 rounded-xl w-full flex-row items-center gap-2">
                    <Feather name="lock" size={18} color="#EF4444" />
                    <Text className="text-xs text-red-700 font-bold flex-1 leading-relaxed">
                      {t("assignments.locked_submission_notice", {
                        defaultValue: "Nhiệm vụ này đã khóa nộp bài sau thời hạn quy định.",
                      })}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowSubmitModal(true)}
                    className="w-full bg-[#0052FF] active:bg-blue-700 py-3.5 px-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-xs"
                  >
                    <Feather name="upload" size={18} color="#ffffff" />
                    <Text className="font-bold text-white text-sm">
                      {t("assignments.upload_task_btn", { defaultValue: "Đăng tải nhiệm vụ" })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Student Status Summary Card */}
              <View className="bg-white rounded-2xl border border-slate-100 shadow-xs mb-4 overflow-hidden">
                <View className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                  <Text className="font-bold text-slate-800 text-sm">
                    {t("assignments.student_submission_status_card", { defaultValue: "Trạng thái nhiệm vụ" })}
                  </Text>
                </View>

                <View className="flex-row border-b border-slate-100 min-h-[44px]">
                  <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                    <Text className="text-xs font-bold text-slate-700">
                      {t("assignments.col_status", { defaultValue: "Trạng thái" })}
                    </Text>
                  </View>
                  <View className="w-7/12 p-3.5 justify-center">
                    {hasActiveSubmission ? (
                      <View className="self-start px-2.5 py-0.5 bg-blue-50 border border-blue-100 rounded-md">
                        <Text className="text-xs font-semibold text-blue-700">
                          {submission?.score !== undefined
                            ? t("assignments.status_returned", { defaultValue: "Đã trả về" })
                            : t("assignments.status_submitted", { defaultValue: "Đã nộp để đánh giá" })}
                        </Text>
                      </View>
                    ) : (
                      <View className="self-start px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md">
                        <Text className="text-xs font-medium text-slate-500">
                          {t("assignments.status_not_submitted", { defaultValue: "Chưa hoàn thành" })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View className="flex-row border-b border-slate-100 min-h-[44px]">
                  <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                    <Text className="text-xs font-bold text-slate-700">
                      {t("assignments.submitted_at_label", { defaultValue: "Thời gian đăng tải" })}
                    </Text>
                  </View>
                  <View className="w-7/12 p-3.5 justify-center">
                    <Text className="text-xs text-slate-700 font-medium">
                      {hasActiveSubmission && submission?.submittedAt
                        ? formatMobileDateTime(submission.submittedAt)
                        : t("assignments.timing_not_submitted", { defaultValue: "Chưa nộp" })}
                    </Text>
                  </View>
                </View>

              <View className="flex-row border-b border-slate-100 min-h-[44px]">
                <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                  <Text className="text-xs font-bold text-slate-700">
                    {t("assignments.score_label", { defaultValue: "Đánh giá" })}
                  </Text>
                </View>
                <View className="w-7/12 p-3.5 justify-center">
                  {submission?.score !== undefined ? (
                    <View className="self-start px-2.5 py-0.5 bg-purple-50 border border-purple-100 rounded-md">
                      <Text className="text-xs font-semibold text-purple-700">
                        {submission.score} / {assignment.maxScore || 10}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-slate-500 font-medium">—</Text>
                  )}
                </View>
              </View>

              <View className="flex-row border-b border-slate-100 min-h-[44px]">
                <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                  <Text className="text-xs font-bold text-slate-700">
                    {t("assignments.time_remaining_label", { defaultValue: "Thời gian còn lại" })}
                  </Text>
                </View>
                <View className="w-7/12 p-3.5 justify-center">
                  {(() => {
                    const ti = getRemainingOrOverdueText(
                      assignment.deadline,
                      hasActiveSubmission ? submission?.submittedAt : undefined
                    );
                    return (
                      <Text
                        className={
                          "text-xs " +
                          (ti.isOverdue
                            ? "text-red-600 font-bold"
                            : "text-slate-700 font-medium")
                        }
                      >
                        {ti.text}
                      </Text>
                    );
                  })()}
                </View>
              </View>

              {/* Nộp tập tin (Submitted Files) */}
              {hasActiveSubmission && submission?.attachments && submission.attachments.length > 0 && (
                <View className="flex-row border-b border-slate-100 min-h-[44px]">
                  <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-start pt-3.5">
                    <Text className="text-xs font-bold text-slate-700">
                      {t("assignments.submitted_files", { defaultValue: "Nộp tập tin" })}
                    </Text>
                  </View>
                  <View className="w-7/12 p-3.5 justify-center gap-2">
                    {submission.attachments.map((att, idx) => {
                      const isDownloading = downloadingAttName === att.name;
                      return (
                        <TouchableOpacity
                          key={att.url || `sub-file-${idx}`}
                          onPress={() => handleDownloadAttachment(att)}
                          disabled={isDownloading}
                          className="flex-row items-center bg-slate-50 border border-slate-200 active:bg-slate-100 rounded-xl p-2.5"
                        >
                          {isDownloading ? (
                            <ActivityIndicator size="small" color="#0052FF" />
                          ) : (
                            <Feather name="file-text" size={16} color="#0052FF" />
                          )}
                          <View className="flex-1 ml-2 mr-1">
                            <Text
                              className="font-semibold text-slate-700 text-xs"
                              numberOfLines={1}
                            >
                              {att.name}
                            </Text>
                            {att.uploadedAt && (
                              <Text className="text-[10px] text-slate-400 mt-0.5">
                                {formatMobileDateTime(att.uploadedAt)}
                              </Text>
                            )}
                          </View>
                          <Feather
                            name="download"
                            size={14}
                            color={isDownloading ? "#0052FF" : "#64748B"}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Comments Section for Student */}
              <View className="flex-row min-h-[44px]">
                <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-start pt-3.5">
                  <Text className="text-xs font-bold text-slate-700">
                    {t("assignments.comments_label", {
                      count: comments.length,
                      defaultValue: `Bình luận (${comments.length})`,
                    })}
                  </Text>
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
                      {isCommentsExpanded
                        ? t("assignments.hide_comments", { defaultValue: "Ẩn bình luận" })
                        : t("assignments.show_comments", { defaultValue: "Xem bình luận" })}
                    </Text>
                  </TouchableOpacity>

                  {isCommentsExpanded && (
                    <View className="mt-3 border-t border-slate-100 pt-3 gap-2.5">
                      {comments.length === 0 ? (
                        <Text className="text-slate-400 text-xs py-1 italic">
                          {t("assignments.no_comments", { defaultValue: "Chưa có bình luận nào." })}
                        </Text>
                      ) : (
                        <View className="gap-2">
                          {comments.map((comment, index) => (
                            <View
                              key={comment._id || `comment-${index}`}
                              className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl gap-1"
                            >
                              <View className="flex-row items-center justify-between">
                                <Text className="font-bold text-xs text-slate-800">
                                  {comment.userName}
                                </Text>
                                {comment.userId === userId &&
                                  onDeleteComment &&
                                  comment._id && (
                                    <TouchableOpacity
                                      onPress={() => handleDeleteCommentClick(comment._id!)}
                                      className="p-1 -mr-1 rounded-md"
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <Feather name="trash-2" size={13} color="#EF4444" />
                                    </TouchableOpacity>
                                  )}
                              </View>
                              <Text className="text-[10px] text-slate-400 -mt-0.5">
                                {formatMobileDateTime(comment.createdAt)}
                              </Text>
                              <Text className="text-xs text-slate-700 leading-relaxed mt-1">
                                {comment.content}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View className="flex-row items-center gap-2 mt-1">
                        <TextInput
                          value={commentText}
                          onChangeText={setCommentText}
                          placeholder={t("assignments.reply_placeholder", {
                            defaultValue: "Viết câu trả lời...",
                          })}
                          placeholderTextColor="#94A3B8"
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 max-h-28"
                          multiline
                          onFocus={handleInputFocus}
                          onContentSizeChange={() =>
                            scrollViewRef.current?.scrollToEnd({ animated: true })
                          }
                        />
                        <TouchableOpacity
                          onPress={handleSendInlineComment}
                          disabled={!commentText.trim() || isSubmittingComment}
                          className={
                            "px-3 py-2.5 rounded-xl items-center justify-center " +
                            (commentText.trim() && !isSubmittingComment
                              ? "bg-[#0052FF] active:bg-blue-700"
                              : "bg-slate-200")
                          }
                        >
                          {isSubmittingComment ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text
                              className={
                                "font-bold text-xs " +
                                (commentText.trim() ? "text-white" : "text-slate-400")
                              }
                            >
                              {t("assignments.send_btn", { defaultValue: "Gửi" })}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Student Feedback / Evaluation Card */}
            {submission && (submission.score !== undefined || submission.gradedAt || submission.feedback) && (
              <View className="bg-white rounded-2xl border border-slate-100 shadow-xs mb-4 overflow-hidden">
                <View className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                  <Text className="font-bold text-slate-800 text-sm">
                    {t("assignments.feedback_card_title", { defaultValue: "Nhận xét" })}
                  </Text>
                </View>

                {/* Dòng 1: Đánh giá */}
                <View className="flex-row border-b border-slate-100 min-h-[44px]">
                  <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                    <Text className="text-xs font-bold text-slate-700">
                      {t("assignments.feedback_grade_label", { defaultValue: "Đánh giá" })}
                    </Text>
                  </View>
                  <View className="w-7/12 p-3.5 justify-center">
                    <Text className="text-xs text-slate-700 font-medium">
                      {formatScoreDisplay(submission.score, assignment.maxScore)}
                    </Text>
                  </View>
                </View>

                {/* Dòng 2: Đánh giá cho */}
                <View
                  className={
                    "flex-row min-h-[44px] " +
                    (submission.feedback ? "border-b border-slate-100" : "")
                  }
                >
                  <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                    <Text className="text-xs font-bold text-slate-700">
                      {t("assignments.feedback_graded_on_label", { defaultValue: "Đánh giá cho" })}
                    </Text>
                  </View>
                  <View className="w-7/12 p-3.5 justify-center">
                    <Text className="text-xs text-slate-700 font-medium">
                      {formatLMSDate(submission.gradedAt || submission.updatedAt)}
                    </Text>
                  </View>
                </View>

                {/* Dòng 3: Lời nhận xét */}
                {submission.feedback && (
                  <View className="flex-row min-h-[44px]">
                    <View className="w-5/12 p-3.5 bg-slate-50/40 border-r border-slate-100 justify-center">
                      <Text className="text-xs font-bold text-slate-700">
                        {t("assignments.feedback_comments_label", { defaultValue: "Lời nhận xét" })}
                      </Text>
                    </View>
                    <View className="w-7/12 p-3.5 justify-center">
                      <Text className="text-xs text-slate-700 leading-relaxed font-medium">
                        {submission.feedback}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </>
          );
        })()}
      </ScrollView>

      {/* Grade Modal for Teacher */}
      <Modal
        visible={!!gradeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setGradeModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-bold text-slate-900 text-base">
                  {t("assignments.evaluation_title", { defaultValue: "Đánh giá" })}
                </Text>
                <TouchableOpacity onPress={() => setGradeModal(null)}>
                  <Feather name="x" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {gradeModal && (
                <>
                  <View className="flex-row items-center gap-3 mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                      <Text className="font-bold text-blue-600 text-base">
                        {(gradeModal.member.displayName || gradeModal.member.name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-bold text-slate-800" numberOfLines={1}>
                        {gradeModal.member.displayName || gradeModal.member.name}
                      </Text>
                      <Text className="text-xs text-slate-400" numberOfLines={1}>
                        {gradeModal.member.email || ""}
                      </Text>
                    </View>
                  </View>

                  {/* Submission Attachments */}
                  {gradeModal.submission?.attachments &&
                    gradeModal.submission.attachments.length > 0 && (
                      <View className="mb-4">
                        <Text className="text-xs font-bold text-slate-700 mb-2 uppercase">
                          {t("assignments.submitted_files_title", {
                            count: gradeModal.submission.attachments.length,
                            defaultValue: `Tệp đã gửi (${gradeModal.submission.attachments.length})`,
                          })}
                        </Text>
                        {gradeModal.submission.attachments.map((att, idx) => {
                          const isDownloading = downloadingAttName === att.name;
                          return (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => handleDownloadAttachment(att)}
                              disabled={isDownloading}
                              className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-1.5"
                            >
                              {isDownloading ? (
                                <ActivityIndicator size="small" color="#0052FF" />
                              ) : (
                                <Feather name="file" size={15} color="#0052FF" />
                              )}
                              <Text
                                className="font-semibold text-slate-700 text-xs ml-2 flex-1"
                                numberOfLines={1}
                              >
                                {att.name}
                              </Text>
                              <Feather
                                name="download"
                                size={14}
                                color={isDownloading ? "#0052FF" : "#64748B"}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                  {assignment.gradingType === "graded" && (
                    <View className="mb-4">
                      <Text className="text-xs font-bold text-slate-700 mb-1.5">
                        {t("assignments.evaluation_label", {
                          maxScore: assignment.maxScore ?? 10,
                          defaultValue: `Đánh giá (tối đa ${assignment.maxScore ?? 10})`,
                        })}
                      </Text>
                      <TextInput
                        value={scoreInput}
                        onChangeText={setScoreInput}
                        keyboardType="numeric"
                        placeholder={`0 - ${assignment.maxScore ?? 10}`}
                        placeholderTextColor="#94A3B8"
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-bold"
                      />
                    </View>
                  )}

                  <View className="mb-5">
                    <Text className="text-xs font-bold text-slate-700 mb-1.5">
                      {t("assignments.feedback_label", { defaultValue: "Nhận xét" })}
                    </Text>
                    <TextInput
                      value={feedbackInput}
                      onChangeText={setFeedbackInput}
                      placeholder={t("assignments.feedback_placeholder", {
                        defaultValue: "Nhập nhận xét cho thành viên...",
                      })}
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={3}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 min-h-[80px]"
                    />
                  </View>

                  {onGradeSubmission && (
                    <TouchableOpacity
                      onPress={handleSaveGradeInModal}
                      disabled={isSavingGrade}
                      className="w-full py-3.5 rounded-2xl bg-[#0052FF] active:bg-blue-700 items-center justify-center"
                    >
                      {isSavingGrade ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="font-bold text-white text-sm">
                          {gradeModal.submission?.score !== undefined
                            ? t("assignments.update_grade_btn", {
                                defaultValue: "Cập nhật đánh giá",
                              })
                            : t("assignments.save_grade_btn", {
                                defaultValue: "Lưu đánh giá",
                              })}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Submission Modal for Student */}
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

      {/* Create Task Selection Modal */}
      <CreateTaskModal
        visible={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSelectAssignment={() => {
          setIsCreateModalOpen(false);
          onCreateClick?.();
        }}
        onSelectQuiz={() => {
          setIsCreateModalOpen(false);
          onCreateQuizClick?.();
        }}
      />

      {/* Member Comments Modal for Teacher */}
      {activeCommentMember && (
        <MemberCommentsModal
          visible={!!activeCommentMember}
          onClose={() => setActiveCommentMember(null)}
          member={activeCommentMember}
          comments={(comments || []).filter((c: any) => {
            const mId =
              activeCommentMember.userId ||
              activeCommentMember.supabaseId ||
              activeCommentMember._id ||
              (activeCommentMember.user as any)?._id;
            return (c.memberId || c.userId) === mId;
          })}
          currentUserId={userId}
          onAddComment={async (content) => {
            const mId =
              activeCommentMember.userId ||
              activeCommentMember.supabaseId ||
              activeCommentMember._id ||
              (activeCommentMember.user as any)?._id;
            await onAddComment(assignment._id, content, mId);
          }}
          onDeleteComment={onDeleteComment}
        />
      )}
    </View>
  );
}
