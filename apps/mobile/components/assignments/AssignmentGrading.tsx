import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Assignment, Submission } from "./types";
import { useFileViewer } from "../../hooks/useFileViewer";
import FileViewerModal from "../common/FileViewerModal";

interface AssignmentGradingProps {
  assignment: Assignment;
  submissions: Submission[];
  roomMembers: any[];
  onBack: () => void;
  onGrade: (submissionId: string, score: number | undefined, feedback: string) => Promise<void>;
  isGrading?: boolean;
}

export default function AssignmentGrading({
  assignment,
  submissions,
  roomMembers,
  onBack,
  onGrade,
  isGrading = false,
}: AssignmentGradingProps) {
  const { t } = useTranslation();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [feedbackInput, setFeedbackInput] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "submitted" | "graded">("all");
  const { selectedFile, isVisible: isFileViewerVisible, openFile, closeFile } = useFileViewer();

  const submissionsMap = new Map(submissions.map((s) => [s.studentId, s]));

  // Assigned members list
  const assignedMembers = roomMembers.filter((member) => {
    // Skip creators / teachers
    if (["owner", "admin", "teacher", "leader"].includes(member.role?.toLowerCase())) {
      return false;
    }
    if (assignment.recipientType === "specific_members" || assignment.recipientType === "current_members") {
      return assignment.recipientMemberIds?.includes(member.userId || member.supabaseId);
    }
    return true;
  });

  const handleOpenGradeModal = (submission: Submission) => {
    setSelectedSubmission(submission);
    setScoreInput(submission.score !== undefined ? String(submission.score) : "");
    setFeedbackInput(submission.feedback || "");
  };

  const handleSaveGrade = async () => {
    if (!selectedSubmission) return;

    let scoreVal: number | undefined = undefined;
    if (assignment.gradingType === "graded") {
      if (scoreInput.trim() !== "") {
        scoreVal = parseFloat(scoreInput);
        if (isNaN(scoreVal) || scoreVal < 0 || (assignment.maxScore && scoreVal > assignment.maxScore)) {
          Alert.alert(t("room.error"), t("assignments.error_score_invalid", { maxScore: assignment.maxScore || 10 }));
          return;
        }
      }
    }

    try {
      await onGrade(selectedSubmission._id, scoreVal, feedbackInput.trim());
      Alert.alert(t("room.success"), t("assignments.toast_grade_success"));
      setSelectedSubmission(null);
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.message || t("assignments.toast_error_generic"));
    }
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

  const filteredMembers = assignedMembers.filter((m) => {
    const userId = m.userId || m.supabaseId;
    const sub = submissionsMap.get(userId);
    if (filterTab === "submitted") return !!sub;
    if (filterTab === "graded") return sub && sub.score !== undefined;
    return true;
  });

  const totalAssigned = assignedMembers.length;
  const totalSubmitted = submissions.length;
  const totalGraded = submissions.filter((s) => s.score !== undefined).length;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Bar */}
      <View className="flex-row items-center justify-between px-4 py-3.5 bg-white border-b border-slate-100">
        <TouchableOpacity onPress={onBack} className="flex-row items-center gap-2">
          <Feather name="arrow-left" size={20} color="#475569" />
          <Text className="font-bold text-slate-800 text-base" numberOfLines={1}>
            {t("assignments.teacher_grading_title")}
          </Text>
        </TouchableOpacity>
        <Text className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
          {totalSubmitted}/{totalAssigned} {t("assignments.submitted_status_text")}
        </Text>
      </View>

      {/* Assignment Header Summary */}
      <View className="bg-white p-4 border-b border-slate-100 mb-3">
        <Text className="font-bold text-slate-800 text-base mb-1" numberOfLines={1}>
          {assignment.title}
        </Text>
        <Text className="text-xs text-slate-500">
          {t("assignments.deadline_label")}: {formatDate(assignment.deadline)} •{" "}
          {assignment.gradingType === "graded"
            ? `${t("assignments.field_max_score")}: ${assignment.maxScore}`
            : t("assignments.grading_ungraded")}
        </Text>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-slate-100 px-4 py-1.5 mb-3">
        <TouchableOpacity
          onPress={() => setFilterTab("all")}
          className={`px-3 py-2 rounded-xl mr-2 ${
            filterTab === "all" ? "bg-blue-50 border border-blue-200" : ""
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              filterTab === "all" ? "text-blue-600" : "text-slate-500"
            }`}
          >
            {t("room.everyone")} ({totalAssigned})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterTab("submitted")}
          className={`px-3 py-2 rounded-xl mr-2 ${
            filterTab === "submitted" ? "bg-emerald-50 border border-emerald-200" : ""
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              filterTab === "submitted" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {t("assignments.submitted_status_text")} ({totalSubmitted})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterTab("graded")}
          className={`px-3 py-2 rounded-xl ${
            filterTab === "graded" ? "bg-purple-50 border border-purple-200" : ""
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              filterTab === "graded" ? "text-purple-600" : "text-slate-500"
            }`}
          >
            {t("assignments.tab_returned")} ({totalGraded})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Student Submissions List */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {filteredMembers.length === 0 ? (
          <View className="py-12 items-center justify-center bg-white rounded-2xl border border-slate-100">
            <Feather name="users" size={36} color="#CBD5E1" />
            <Text className="text-slate-400 text-sm mt-2 font-medium">
              {t("assignments.no_data")}
            </Text>
          </View>
        ) : (
          filteredMembers.map((member) => {
            const userId = member.userId || member.supabaseId;
            const submission = submissionsMap.get(userId);
            const isGraded = submission && submission.score !== undefined;

            return (
              <View
                key={userId}
                className="bg-white border border-slate-100 rounded-2xl p-4 mb-3 shadow-xs"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                      <Text className="font-bold text-blue-600 text-xs">
                        {(member.displayName || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text className="font-bold text-slate-800 text-sm">
                        {member.displayName || t("room.member")}
                      </Text>
                      <Text className="text-xs text-slate-400">
                        {member.email || t("room.role_student")}
                      </Text>
                    </View>
                  </View>

                  {/* Submission Status Badge */}
                  {submission ? (
                    <View
                      className={`px-2.5 py-1 rounded-full ${
                        isGraded
                          ? "bg-purple-100"
                          : submission.submissionStatus === "late"
                          ? "bg-amber-100"
                          : "bg-emerald-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isGraded
                            ? "text-purple-700"
                            : submission.submissionStatus === "late"
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {isGraded
                          ? t("assignments.graded_status_text", { score: submission.score, maxScore: assignment.maxScore || 10 })
                          : submission.submissionStatus === "late"
                          ? t("assignments.late_status_text")
                          : t("assignments.submitted_status_text")}
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                      <Text className="text-xs font-semibold text-slate-500">
                        {t("assignments.not_submitted_status_text")}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Submission Info & Attachments */}
                {submission && (
                  <View className="mt-2 pt-2 border-t border-slate-100">
                    <Text className="text-xs text-slate-500 mb-2">
                      {t("assignments.submitted_at", { time: formatDate(submission.submittedAt) })}
                    </Text>

                    {/* Files list */}
                    {submission.attachments?.map((att, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => openFile(att)}
                        className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-1.5"
                      >
                        <Feather name="file-text" size={16} color="#0052FF" />
                        <Text
                          className="font-semibold text-slate-700 text-xs ml-2 flex-1"
                          numberOfLines={1}
                        >
                          {att.name}
                        </Text>
                        <Feather name="external-link" size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    ))}

                    {/* Grade Button */}
                    <TouchableOpacity
                      onPress={() => handleOpenGradeModal(submission)}
                      className="mt-2 bg-[#0052FF] active:bg-blue-700 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
                    >
                      <Feather name="edit-3" size={16} color="#ffffff" />
                      <Text className="font-bold text-white text-xs">
                        {t("assignments.save_grade_btn")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Grade Modal */}
      {selectedSubmission && (
        <Modal
          visible={!!selectedSubmission}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedSubmission(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 bg-black/50 justify-center items-center p-6"
          >
            <View className="bg-white rounded-2xl w-full p-5 shadow-2xl">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="font-bold text-slate-800 text-base">
                  {t("assignments.teacher_grading_title")}
                </Text>
                <TouchableOpacity onPress={() => setSelectedSubmission(null)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Score Input */}
              {assignment.gradingType === "graded" && (
                <View className="mb-4">
                  <Text className="font-bold text-slate-700 text-xs mb-1.5">
                    {t("assignments.score_input_label", { maxScore: assignment.maxScore || 10 })}
                  </Text>
                  <TextInput
                    value={scoreInput}
                    onChangeText={setScoreInput}
                    keyboardType="numeric"
                    placeholder={`0 - ${assignment.maxScore || 10}`}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800"
                  />
                </View>
              )}

              {/* Feedback Input */}
              <View className="mb-5">
                <Text className="font-bold text-slate-700 text-xs mb-1.5">
                  {t("assignments.feedback_input_label")}
                </Text>
                <TextInput
                  value={feedbackInput}
                  onChangeText={setFeedbackInput}
                  multiline
                  numberOfLines={3}
                  placeholder={t("assignments.feedback_input_label")}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 h-24"
                  textAlignVertical="top"
                />
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setSelectedSubmission(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 items-center"
                >
                  <Text className="font-bold text-slate-600 text-sm">{t("assignments.cancel_btn")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveGrade}
                  disabled={isGrading}
                  className="flex-1 py-3 rounded-xl bg-[#0052FF] active:bg-blue-700 items-center flex-row justify-center gap-1.5"
                >
                  {isGrading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather name="check-circle" size={16} color="#ffffff" />
                  )}
                  <Text className="font-bold text-white text-sm">{t("assignments.save_grade_btn")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* In-App File Viewer Modal */}
      <FileViewerModal
        visible={isFileViewerVisible}
        file={selectedFile}
        onClose={closeFile}
      />
    </View>
  );
}
