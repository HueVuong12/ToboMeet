import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import {
  assignmentsApi,
  useGetAssignmentDetailQuery,
  useGetMySubmissionQuery,
  useGetSubmissionsQuery,
  useGetAssignmentCommentsQuery,
  useSubmitAssignmentMutation,
  useDeleteSubmissionMutation,
  useAddAssignmentCommentMutation,
  useDeleteAssignmentCommentMutation,
  useGradeSubmissionMutation,
} from "../../lib/redux/api/assignmentsApi";
import { supabase } from "../../lib/supabase";
import { socket } from "../../lib/socket";
import AssignmentDetail from "../../components/assignments/AssignmentDetail";
import AssignmentGrading from "../../components/assignments/AssignmentGrading";

export default function AssignmentDetailScreen() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const router = useRouter();
  const { id, roomId: paramRoomId } = useLocalSearchParams<{ id: string; roomId?: string }>();
  const assignmentId = id as string;

  const [userId, setUserId] = useState<string>("");
  const [view, setView] = useState<"detail" | "grade">("detail");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  const {
    data: assignment,
    isLoading: isLoadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useGetAssignmentDetailQuery(assignmentId, {
    skip: !assignmentId,
  });

  const isTeacher =
    assignment && userId
      ? assignment.createdBy === userId || assignment.isTeacher === true
      : false;

  const { data: mySubmission = null, refetch: refetchMySubmission } = useGetMySubmissionQuery(
    assignmentId,
    { skip: !assignmentId || isTeacher }
  );

  const { data: submissions = [], refetch: refetchSubmissions } = useGetSubmissionsQuery(
    assignmentId,
    { skip: !assignmentId || !isTeacher }
  );

  const { data: comments = [], refetch: refetchComments } = useGetAssignmentCommentsQuery(
    assignmentId,
    { skip: !assignmentId }
  );

  const [submitAssignment, { isLoading: isSubmitting }] = useSubmitAssignmentMutation();
  const [deleteSubmission] = useDeleteSubmissionMutation();
  const [addAssignmentComment] = useAddAssignmentCommentMutation();
  const [deleteAssignmentComment] = useDeleteAssignmentCommentMutation();
  const [gradeSubmission, { isLoading: isGrading }] = useGradeSubmissionMutation();

  const targetRoomId = assignment?.roomId || paramRoomId;

  // Realtime Socket.IO Listeners
  useEffect(() => {
    const joinRoomSocket = () => {
      if (targetRoomId) {
        console.log("[MOBILE-SCREEN] [SOCKET] Emitting join_room for roomId:", targetRoomId);
        socket.emit("join_room", targetRoomId);
      }
    };

    const handleConnect = () => {
      joinRoomSocket();
      refetchDetail();
    };

    socket.on("connect", handleConnect);

    if (socket.connected) {
      joinRoomSocket();
    } else {
      socket.connect();
    }

    const handleAssignmentUpdated = (data: any) => {
      const eventAssignId = String(data?.assignmentId || data?._id || data?.assignment?._id || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        refetchDetail();
      }
    };

    const handleAssignmentDeleted = (data: any) => {
      const eventAssignId = String(data?.assignmentId || data?._id || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        Alert.alert(t("room.notice"), t("assignments.deleted_notice"), [
          {
            text: "OK",
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/dashboard");
              }
            },
          },
        ]);
      }
    };

    const handleAssignmentSubmitted = (data: any) => {
      const eventAssignId = String(data?.submission?.assignmentId || data?.assignmentId || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        if (isTeacher) {
          refetchSubmissions();
        } else {
          refetchMySubmission();
        }
      }
    };

    const handleSubmissionDeleted = (data: any) => {
      console.log("[MOBILE-SCREEN] Received assignment_submission_deleted event:", data);
      const eventAssignId = String(data?.assignmentId || data?.submission?.assignmentId || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        console.log("[MOBILE-SCREEN] [CACHE] Updating getMySubmission cache to null for assignment:", eventAssignId);
        dispatch(
          assignmentsApi.util.updateQueryData("getMySubmission", eventAssignId, () => null)
        );
        dispatch(
          assignmentsApi.util.invalidateTags([
            { type: "Submissions", id: "LIST" },
            { type: "Submissions", id: `MY_${eventAssignId}` },
            { type: "Assignments", id: "LIST" },
            { type: "Assignments", id: eventAssignId },
          ])
        );
        if (isTeacher) {
          refetchSubmissions();
        } else {
          refetchMySubmission();
        }
      }
    };

    const handleAssignmentGraded = (data: any) => {
      const eventAssignId = String(data?.submission?.assignmentId || data?.assignmentId || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        if (isTeacher) {
          refetchSubmissions();
        } else {
          refetchMySubmission();
        }
      }
    };

    const handleCommentAdded = (data: any) => {
      const eventAssignId = String(data?.assignmentId || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        refetchComments();
      }
    };

    const handleCommentDeleted = (data: any) => {
      const eventAssignId = String(data?.assignmentId || "");
      if (eventAssignId && eventAssignId === String(assignmentId)) {
        if (data.commentId) {
          dispatch(
            assignmentsApi.util.updateQueryData("getAssignmentComments", eventAssignId, (draft) => {
              if (Array.isArray(draft)) {
                return draft.filter((c: any) => c._id !== data.commentId);
              }
              return draft;
            })
          );
        }
        refetchComments();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("assignment_updated", handleAssignmentUpdated);
    socket.on("assignment_deleted", handleAssignmentDeleted);
    socket.on("assignment_published", handleAssignmentUpdated);
    socket.on("assignment_submitted", handleAssignmentSubmitted);
    socket.on("assignment_submission_deleted", handleSubmissionDeleted);
    socket.on("assignment_graded", handleAssignmentGraded);
    socket.on("assignment_comment_added", handleCommentAdded);
    socket.on("assignment_comment_deleted", handleCommentDeleted);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("assignment_updated", handleAssignmentUpdated);
      socket.off("assignment_deleted", handleAssignmentDeleted);
      socket.off("assignment_published", handleAssignmentUpdated);
      socket.off("assignment_submitted", handleAssignmentSubmitted);
      socket.off("assignment_submission_deleted", handleSubmissionDeleted);
      socket.off("assignment_graded", handleAssignmentGraded);
      socket.off("assignment_comment_added", handleCommentAdded);
      socket.off("assignment_comment_deleted", handleCommentDeleted);
    };
  }, [assignmentId, targetRoomId, refetchDetail, isTeacher, refetchMySubmission, refetchSubmissions, refetchComments, t]);

  const handleSubmitAssignment = async (attachments: any[]) => {
    if (!assignmentId) return;
    try {
      await submitAssignment({ id: assignmentId, body: { attachments } }).unwrap();
      Alert.alert(t("room.success"), t("assignments.toast_submit_success"));
      refetchMySubmission();
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleDeleteSubmission = async () => {
    if (!assignmentId) return;
    try {
      await deleteSubmission(assignmentId).unwrap();
      dispatch(
        assignmentsApi.util.updateQueryData("getMySubmission", String(assignmentId), () => null)
      );
      Alert.alert(t("room.success"), t("assignments.remove_submission"));
      refetchMySubmission();
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleAddComment = async (targetAssignmentId: string, content: string) => {
    try {
      await addAssignmentComment({
        assignmentId: targetAssignmentId,
        content,
      }).unwrap();
      refetchComments();
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!assignmentId) return;
    try {
      await deleteAssignmentComment({
        assignmentId,
        commentId,
      }).unwrap();
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || "Xóa phản hồi thất bại");
    }
  };

  const handleGradeSubmission = async (
    submissionId: string,
    score: number | undefined,
    feedback: string
  ) => {
    if (!assignmentId) return;
    try {
      await gradeSubmission({
        submissionId,
        body: { score, feedback },
        assignmentId,
      }).unwrap();
      refetchSubmissions();
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  if (isLoadingDetail) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  if (detailError || !assignment) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-slate-800 font-bold text-base mt-4 text-center">
          {t("assignments.deleted_notice")}
        </Text>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))}
          className="mt-6 bg-[#0052FF] px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold text-sm">{t("dashboard.step_back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {view === "detail" && (
        <AssignmentDetail
          assignment={assignment}
          submission={mySubmission}
          isTeacher={isTeacher}
          roomMembers={[]}
          comments={comments}
          userId={userId}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))}
          onSubmit={handleSubmitAssignment}
          isSubmitting={isSubmitting}
          onGradeClick={() => setView("grade")}
          refetchSubmission={refetchMySubmission}
          onDeleteSubmission={handleDeleteSubmission}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
        />
      )}

      {view === "grade" && (
        <AssignmentGrading
          assignment={assignment}
          submissions={submissions}
          roomMembers={[]}
          onBack={() => setView("detail")}
          onGrade={handleGradeSubmission}
          isGrading={isGrading}
        />
      )}
    </View>
  );
}
