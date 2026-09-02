import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../lib/redux/store";
import {
  assignmentsApi,
  useGetRoomAssignmentsQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useDeleteAssignmentMutation,
  useSubmitAssignmentMutation,
  useGetSubmissionsQuery,
  useGetMySubmissionQuery,
  useGradeSubmissionMutation,
  useDeleteSubmissionMutation,
  useGetAssignmentCommentsQuery,
  useAddAssignmentCommentMutation,
  useDeleteAssignmentCommentMutation,
} from "../../lib/redux/api/assignmentsApi";
import { Assignment } from "./types";
import AssignmentList from "./AssignmentList";
import AssignmentCreate from "./AssignmentCreate";
import AssignmentDetail from "./AssignmentDetail";
import AssignmentGrading from "./AssignmentGrading";
import QuizCreate from "./quiz/QuizCreate";
import { socket } from "../../lib/socket";

interface AssignmentModuleProps {
  roomId: string;
  userId: string;
  channels: any[];
  roomMembers: any[];
  onViewChange?: (view: string) => void;
  onOpenLeftDrawer?: () => void;
  onOpenRightDrawer?: () => void;
}

export default function AssignmentModule({
  roomId,
  userId,
  channels = [],
  roomMembers = [],
  onViewChange,
  onOpenLeftDrawer,
  onOpenRightDrawer,
}: AssignmentModuleProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();
  const [view, setView] = useState<"list" | "create" | "create_quiz" | "edit" | "detail" | "grade">("list");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "grading" | "overdue" | "returned" | "draft">("upcoming");

  const { data: assignments = [], isLoading, refetch, isFetching } = useGetRoomAssignmentsQuery({
    roomId,
    status: activeTab === "draft" ? "draft" : undefined,
  });

  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  // Determine if current user is teacher / owner
  const currentUserRole = roomMembers.find(
    (m: any) => (m.userId || m.supabaseId) === userId
  )?.role;
  const isTeacher =
    ["owner", "admin", "teacher", "leader"].includes(currentUserRole?.toLowerCase() || "") ||
    roomMembers[0]?.userId === userId;

  // Queries for student submission - phải khai báo TRƯỚC useEffect
  const { data: mySubmission = null, refetch: refetchMySubmission } = useGetMySubmissionQuery(
    selectedAssignment?._id || "",
    { skip: !selectedAssignment || isTeacher }
  );

  // Queries for teacher submissions
  const { data: submissions = [], refetch: refetchSubmissions } = useGetSubmissionsQuery(
    selectedAssignment?._id || "",
    { skip: !selectedAssignment || !isTeacher }
  );

  // Comments query
  const { data: comments = [], refetch: refetchComments } = useGetAssignmentCommentsQuery(
    selectedAssignment?._id || "",
    { skip: !selectedAssignment }
  );

  // Stable refs để tránh stale closures trong socket listeners
  const selectedAssignmentRef = React.useRef(selectedAssignment);
  const refetchMySubmissionRef = React.useRef(refetchMySubmission);
  const refetchSubmissionsRef = React.useRef(refetchSubmissions);
  const refetchCommentsRef = React.useRef(refetchComments);
  const isTeacherRef = React.useRef(isTeacher);

  useEffect(() => { selectedAssignmentRef.current = selectedAssignment; }, [selectedAssignment]);
  useEffect(() => { refetchMySubmissionRef.current = refetchMySubmission; }, [refetchMySubmission]);
  useEffect(() => { refetchSubmissionsRef.current = refetchSubmissions; }, [refetchSubmissions]);
  useEffect(() => { refetchCommentsRef.current = refetchComments; }, [refetchComments]);
  useEffect(() => { isTeacherRef.current = isTeacher; }, [isTeacher]);

  // Realtime Socket.IO synchronization for Mobile
  // Dependency array KHÔNG có selectedAssignment/refetch functions để tránh re-register listeners
  useEffect(() => {
    const joinRoomSocket = () => {
      if (roomId) {
        console.log("[MOBILE] [SOCKET] Emitting join_room for roomId:", roomId);
        socket.emit("join_room", roomId);
      }
    };

    const handleConnect = () => {
      joinRoomSocket();
      refetch();
    };

    // Đăng ký connect handler TRƯỚC khi connect
    socket.on("connect", handleConnect);

    if (socket.connected) {
      joinRoomSocket();
    } else {
      socket.connect();
    }

    const handleAssignmentCreated = (data: any) => {
      if (data.roomId === roomId) refetch();
    };

    const handleAssignmentPublished = (data: any) => {
      if (data.roomId === roomId) refetch();
    };

    const handleAssignmentUpdated = (data: any) => {
      if (data.roomId === roomId) {
        refetch();
        const eventAssignId = String(data.assignmentId || data.assignment?._id || data._id || "");
        const cur = selectedAssignmentRef.current;
        if (cur && eventAssignId && eventAssignId === String(cur._id)) {
          setSelectedAssignment((prev) => prev ? { ...prev, ...(data.assignment || {}) } : null);
        }
      }
    };

    const handleAssignmentDeleted = (data: any) => {
      if (data.roomId === roomId || data.assignmentId) {
        refetch();
        const deletedId = String(data.assignmentId || data._id || "");
        const cur = selectedAssignmentRef.current;
        if (cur && deletedId && String(cur._id) === deletedId) {
          Alert.alert(t("room.notice"), t("assignments.deleted_notice"));
          setSelectedAssignment(null);
          setView("list");
        }
      }
    };

    const handleAssignmentSubmitted = (data: any) => {
      if (data.roomId === roomId) {
        refetch?.();
        const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
        const cur = selectedAssignmentRef.current;
        if (cur && eventAssignId && eventAssignId === String(cur._id)) {
          if (isTeacherRef.current) {
            try { refetchSubmissionsRef.current?.(); } catch (e) {}
          } else {
            try { refetchMySubmissionRef.current?.(); } catch (e) {}
          }
        }
      }
    };

    const handleSubmissionDeleted = (data: any) => {
      console.log("[MOBILE] Received assignment_submission_deleted event:", data);
      const eventAssignId = String(data.assignmentId || data.submission?.assignmentId || "");
      if (eventAssignId) {
        console.log("[MOBILE] [CACHE] Updating getMySubmission cache to null for assignment:", eventAssignId);
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
      }
      refetch?.();
      // Chỉ refetch submission query nếu người dùng đang thực sự xem bài tập đó
      if (selectedAssignmentRef.current) {
        if (isTeacherRef.current) {
          try { refetchSubmissionsRef.current?.(); } catch (e) {}
        } else {
          try { refetchMySubmissionRef.current?.(); } catch (e) {}
        }
      }
    };

    const handleAssignmentGraded = (data: any) => {
      if (data.roomId === roomId) {
        refetch?.();
        const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
        const cur = selectedAssignmentRef.current;
        if (cur && eventAssignId && eventAssignId === String(cur._id)) {
          if (isTeacherRef.current) {
            try { refetchSubmissionsRef.current?.(); } catch (e) {}
          } else {
            try { refetchMySubmissionRef.current?.(); } catch (e) {}
          }
        }
      }
    };

    const handleCommentAdded = (data: any) => {
      const eventAssignId = String(data.assignmentId || "");
      const cur = selectedAssignmentRef.current;
      if (cur && eventAssignId && eventAssignId === String(cur._id)) {
        try { refetchCommentsRef.current?.(); } catch (e) {}
      }
    };

    const handleCommentDeleted = (data: any) => {
      const eventAssignId = String(data.assignmentId || "");
      const cur = selectedAssignmentRef.current;
      if (cur && eventAssignId && eventAssignId === String(cur._id)) {
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
        try { refetchCommentsRef.current?.(); } catch (e) {}
      }
    };

    socket.on("assignment_created", handleAssignmentCreated);
    socket.on("assignment_published", handleAssignmentPublished);
    socket.on("assignment_updated", handleAssignmentUpdated);
    socket.on("assignment_deleted", handleAssignmentDeleted);
    socket.on("assignment_submitted", handleAssignmentSubmitted);
    socket.on("assignment_submission_deleted", handleSubmissionDeleted);
    socket.on("assignment_graded", handleAssignmentGraded);
    socket.on("assignment_comment_added", handleCommentAdded);
    socket.on("assignment_comment_deleted", handleCommentDeleted);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("assignment_created", handleAssignmentCreated);
      socket.off("assignment_published", handleAssignmentPublished);
      socket.off("assignment_updated", handleAssignmentUpdated);
      socket.off("assignment_deleted", handleAssignmentDeleted);
      socket.off("assignment_submitted", handleAssignmentSubmitted);
      socket.off("assignment_submission_deleted", handleSubmissionDeleted);
      socket.off("assignment_graded", handleAssignmentGraded);
      socket.off("assignment_comment_added", handleCommentAdded);
      socket.off("assignment_comment_deleted", handleCommentDeleted);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const router = useRouter();

  const [createAssignment, { isLoading: isCreating }] = useCreateAssignmentMutation();
  const [updateAssignment, { isLoading: isUpdating }] = useUpdateAssignmentMutation();
  const [deleteAssignment] = useDeleteAssignmentMutation();
  const [submitAssignment, { isLoading: isSubmitting }] = useSubmitAssignmentMutation();
  const [gradeSubmission, { isLoading: isGrading }] = useGradeSubmissionMutation();
  const [deleteSubmission] = useDeleteSubmissionMutation();
  const [addAssignmentComment] = useAddAssignmentCommentMutation();
  const [deleteAssignmentComment] = useDeleteAssignmentCommentMutation();

  const handleSelectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    if (assignment.status === "draft") {
      setView("edit");
    } else {
      router.push({
        pathname: "/assignment/[id]",
        params: { id: assignment._id, roomId },
      });
    }
  };

  const handleCreateAssignment = async (payload: any) => {
    try {
      if (view === "edit" && selectedAssignment) {
        const updated = await updateAssignment({ id: selectedAssignment._id, body: payload }).unwrap();
        Alert.alert(t("room.success"), t("assignments.toast_update_success", { defaultValue: "Cập nhật nhiệm vụ thành công!" }));
        setSelectedAssignment((prev) => (prev ? { ...prev, ...payload, ...(updated || {}) } : null));
        setView("detail");
      } else {
        await createAssignment(payload).unwrap();
        Alert.alert(
          t("room.success"),
          payload.status === "published"
            ? t("assignments.toast_create_success")
            : t("assignments.toast_save_draft_success")
        );
        setView("list");
        setSelectedAssignment(null);
      }
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleSubmitAssignment = async (attachments: any[]) => {
    if (!selectedAssignment) return;
    try {
      await submitAssignment({ id: selectedAssignment._id, body: { attachments } }).unwrap();
      Alert.alert(t("room.success"), t("assignments.toast_submit_success"));
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleDeleteSubmission = async () => {
    if (!selectedAssignment) return;
    try {
      await deleteSubmission(selectedAssignment._id).unwrap();
      dispatch(
        assignmentsApi.util.updateQueryData("getMySubmission", selectedAssignment._id, () => null)
      );
      Alert.alert(t("room.success"), t("assignments.remove_submission"));
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;
    try {
      await deleteAssignment(selectedAssignment._id).unwrap();
      Alert.alert(t("room.success"), t("assignments.deleted_notice"));
      setSelectedAssignment(null);
      setView("list");
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
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || t("assignments.toast_error_generic"));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedAssignment) return;
    try {
      await deleteAssignmentComment({
        assignmentId: selectedAssignment._id,
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
    if (!selectedAssignment) return;
    try {
      await gradeSubmission({
        submissionId,
        body: { score, feedback },
        assignmentId: selectedAssignment._id,
      }).unwrap();
      try { refetchSubmissions(); } catch (e) {}
    } catch (err: any) {
      Alert.alert(t("room.error"), err?.data?.message || err?.message || t("assignments.toast_error_generic"));
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {view === "list" && (
        <AssignmentList
          assignments={assignments}
          isTeacher={isTeacher}
          onSelect={handleSelectAssignment}
          onCreateClick={() => setView("create")}
          onCreateQuizClick={() => setView("create_quiz")}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRefresh={refetch}
          isRefreshing={isFetching}
          onOpenLeftDrawer={onOpenLeftDrawer}
          onOpenRightDrawer={onOpenRightDrawer}
        />
      )}

      {(view === "create" || view === "edit") && (
        <AssignmentCreate
          roomId={roomId}
          channels={channels}
          roomMembers={roomMembers}
          userId={userId}
          assignmentToEdit={view === "edit" ? selectedAssignment || undefined : undefined}
          onBack={() => {
            if (view === "edit" && selectedAssignment) {
              setView("detail");
            } else {
              setView("list");
              setSelectedAssignment(null);
            }
          }}
          onSubmit={handleCreateAssignment}
          isSubmitting={isCreating || isUpdating}
        />
      )}

      {view === "create_quiz" && (
        <QuizCreate
          roomId={roomId}
          channels={channels}
          roomMembers={roomMembers}
          userId={userId}
          onBack={() => {
            setView("list");
          }}
        />
      )}

      {view === "detail" && selectedAssignment && (
        <AssignmentDetail
          assignment={selectedAssignment}
          submission={mySubmission}
          isTeacher={isTeacher}
          roomMembers={roomMembers}
          comments={comments}
          userId={userId}
          onBack={() => {
            setView("list");
            setSelectedAssignment(null);
          }}
          onSubmit={handleSubmitAssignment}
          isSubmitting={isSubmitting}
          onGradeClick={() => setView("grade")}
          onEditAssignment={() => setView("edit")}
          refetchSubmission={refetchMySubmission}
          onDeleteSubmission={handleDeleteSubmission}
          onDeleteAssignment={handleDeleteAssignment}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
        />
      )}

      {view === "grade" && selectedAssignment && (
        <AssignmentGrading
          assignment={selectedAssignment}
          submissions={submissions}
          roomMembers={roomMembers}
          onBack={() => setView("detail")}
          onGrade={handleGradeSubmission}
          isGrading={isGrading}
        />
      )}
    </View>
  );
}
