import React, { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/lib/redux/store";
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
  useAddSubmissionCommentMutation,
  useGetAssignmentCommentsQuery,
  useAddAssignmentCommentMutation,
  useDeleteAssignmentCommentMutation,
} from "@/lib/redux/api/assignmentsApi";
import { Assignment } from "./types";
import AssignmentList from "./AssignmentList";
import AssignmentCreate from "./AssignmentCreate";
import AssignmentDetail from "./AssignmentDetail";
import AssignmentGrading from "./AssignmentGrading";
import QuizCreate from "./quiz/QuizCreate";
import { Loader2 } from "lucide-react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface AssignmentModuleProps {
  roomId: string;
  userId: string;
  channels: any[];
  roomMembers: any[];
  onViewChange?: (view: string) => void;
}

export default function AssignmentModule({
  roomId,
  userId,
  channels,
  roomMembers,
  onViewChange,
}: AssignmentModuleProps) {
  const t = useTranslations("room.assignments_i18n");
  const deletingAssignmentIdRef = useRef<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const [view, setView] = useState<"list" | "create" | "create_quiz" | "edit" | "detail" | "grade">("list");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "grading" | "overdue" | "returned" | "draft">("upcoming");

  const { data: assignments = [], isLoading, refetch } = useGetRoomAssignmentsQuery({
    roomId,
    status: activeTab === "draft" ? "draft" : undefined,
  });

  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  useEffect(() => {
    const handleTriggerAssignment = () => {
      setView("create");
    };
    const handleTriggerQuiz = () => {
      setView("create_quiz");
    };

    window.addEventListener("trigger-create-assignment", handleTriggerAssignment);
    window.addEventListener("trigger-create-quiz", handleTriggerQuiz);

    return () => {
      window.removeEventListener("trigger-create-assignment", handleTriggerAssignment);
      window.removeEventListener("trigger-create-quiz", handleTriggerQuiz);
    };
  }, []);



  const [createAssignment, { isLoading: isCreating }] = useCreateAssignmentMutation();
  const [updateAssignment, { isLoading: isUpdating }] = useUpdateAssignmentMutation();
  const [submitAssignment, { isLoading: isSubmitting }] = useSubmitAssignmentMutation();
  const [gradeSubmission, { isLoading: isGrading }] = useGradeSubmissionMutation();
  const [deleteSubmission] = useDeleteSubmissionMutation();
  const [addAssignmentComment] = useAddAssignmentCommentMutation();
  const [deleteAssignmentComment] = useDeleteAssignmentCommentMutation();
  const [deleteAssignment] = useDeleteAssignmentMutation();

  // Xác định xem user có phải giáo viên/chủ phòng hay không
  // Dựa vào members list truyền từ RoomContent
  const currentUserRole = roomMembers.find((m: any) => m.userId === userId)?.role;
  const isTeacher =
    ["owner", "admin", "teacher", "leader"].includes(currentUserRole?.toLowerCase() || "") ||
    roomMembers[0]?.userId === userId; // fallback: đầu danh sách thường là owner

  // Queries cho học viên
  const { data: mySubmission = null, refetch: refetchMySubmission } = useGetMySubmissionQuery(
    selectedAssignment?._id || "",
    { skip: !selectedAssignment || isTeacher }
  );

  // Queries cho giáo viên
  const { data: submissions = [], refetch: refetchSubmissions } = useGetSubmissionsQuery(
    selectedAssignment?._id || "",
    { skip: !selectedAssignment || !isTeacher }
  );

  // Comments độc lập
  const { data: comments = [], refetch: refetchComments } = useGetAssignmentCommentsQuery(
    selectedAssignment?._id || "",
    { skip: !selectedAssignment }
  );


  // Dùng ref để giữ tham chiếu tới các hàm mới nhất, tránh stale closures trong socket listeners
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

  // Realtime Socket.IO synchronization for Web
  // Dependency array KHÔNG có selectedAssignment/refetch functions để tránh re-register listeners
  useEffect(() => {
    const joinRoomSocket = () => {
      if (roomId) {
        console.log("[WEB] [SOCKET] Emitting join_room for roomId:", roomId);
        socket.emit("join_room", roomId);
      }
    };

    const handleConnect = () => {
      joinRoomSocket();
      refetch();
    };

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
        const currentSelected = selectedAssignmentRef.current;
        if (currentSelected && eventAssignId && eventAssignId === String(currentSelected._id)) {
          setSelectedAssignment((prev) =>
            prev ? { ...prev, ...(data.assignment || {}) } : null
          );
        }
      }
    };

    const handleAssignmentDeleted = (data: any) => {
      if (data.roomId === roomId || data.assignmentId) {
        refetch();
        const deletedId = String(data.assignmentId || data._id || "");
        // Nếu chính client này vừa thực hiện thao tác xóa nhiệm vụ này, bỏ qua hoàn toàn toast đỏ
        if (deletingAssignmentIdRef.current && deletingAssignmentIdRef.current === deletedId) {
          return;
        }
        const currentSelected = selectedAssignmentRef.current;
        if (currentSelected && deletedId && String(currentSelected._id) === deletedId) {
          toast.error(t("toast_deleted_by_system"));
          setSelectedAssignment(null);
          setView("list");
        }
      }
    };

    const handleAssignmentSubmitted = (data: any) => {
      if (data.roomId === roomId) {
        refetch();
        const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
        const currentSelected = selectedAssignmentRef.current;
        if (currentSelected && eventAssignId && eventAssignId === String(currentSelected._id)) {
          if (isTeacherRef.current) {
            try { refetchSubmissionsRef.current?.(); } catch (e) {}
          } else {
            try { refetchMySubmissionRef.current?.(); } catch (e) {}
          }
        }
      }
    };

    const handleSubmissionDeleted = (data: any) => {
      console.log("[WEB] Received assignment_submission_deleted event:", data);
      const eventAssignId = String(data.assignmentId || data.submission?.assignmentId || "");
      if (eventAssignId) {
        console.log("[WEB] [CACHE] Updating getMySubmission cache to null for assignment:", eventAssignId);
        dispatch(
          assignmentsApi.util.updateQueryData("getMySubmission", eventAssignId, () => null)
        );
        dispatch(
          assignmentsApi.util.updateQueryData("getSubmissions", eventAssignId, (draft) => {
            if (Array.isArray(draft)) {
              return draft.filter(
                (s: any) => s._id !== data.submissionId && s.studentId !== data.studentId
              );
            }
            return draft;
          })
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
      refetch();
      // Chỉ refetch submission query nếu người dùng đang thực sự xem bài tập đó (query không bị skip)
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
        refetch();
        const eventAssignId = String(data.submission?.assignmentId || data.assignmentId || "");
        const currentSelected = selectedAssignmentRef.current;
        if (currentSelected && eventAssignId && eventAssignId === String(currentSelected._id)) {
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
      const currentSelected = selectedAssignmentRef.current;
      if (currentSelected && eventAssignId && eventAssignId === String(currentSelected._id)) {
        refetchCommentsRef.current();
      }
    };

    const handleCommentDeleted = (data: any) => {
      const eventAssignId = String(data.assignmentId || "");
      const currentSelected = selectedAssignmentRef.current;
      if (currentSelected && eventAssignId && eventAssignId === String(currentSelected._id)) {
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
        refetchCommentsRef.current();
      }
    };

    // Đăng ký connect handler TRƯỚC khi connect
    socket.on("connect", handleConnect);

    // Nếu đã connected thì join room ngay, nếu chưa thì connect
    if (socket.connected) {
      joinRoomSocket();
    } else {
      socket.connect();
    }

    socket.on("assignment_created", handleAssignmentCreated);
    socket.on("assignment_published", handleAssignmentPublished);
    socket.on("assignment_updated", handleAssignmentUpdated);
    socket.off("assignment_deleted");
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

  const handleSelectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    if (assignment.status === "draft") {
      setView("edit");
    } else {
      setView("detail");
    }
  };

  const handleCreateAssignment = async (payload: any) => {
    try {
      if (view === "edit" && selectedAssignment) {
        const updated = await updateAssignment({ id: selectedAssignment._id, body: payload }).unwrap();
        toast.success(t("toast_update_success"));
        setSelectedAssignment((prev) => (prev ? { ...prev, ...payload, ...(updated || {}) } : null));
        setView("detail");
      } else {
        await createAssignment(payload).unwrap();
        toast.success(payload.status === "published" ? t("toast_create_success") : t("toast_save_draft_success"));
        setView("list");
        setSelectedAssignment(null);
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("toast_error_generic"));
    }
  };

  const handleSubmitAssignment = async (attachments: any[]) => {
    if (!selectedAssignment) return;
    try {
      await submitAssignment({ id: selectedAssignment._id, body: { attachments } }).unwrap();
      toast.success(t("toast_submit_success"));
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("toast_submit_failed"));
    }
  };

  const handleDeleteSubmission = async () => {
    if (!selectedAssignment) return;
    try {
      await deleteSubmission(selectedAssignment._id).unwrap();
      dispatch(
        assignmentsApi.util.updateQueryData("getMySubmission", selectedAssignment._id, () => null)
      );
      toast.success(t("toast_unsubmit_success"));
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("toast_unsubmit_failed"));
    }
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;
    const targetId = String(selectedAssignment._id);
    try {
      deletingAssignmentIdRef.current = targetId;
      await deleteAssignment(targetId).unwrap();
      toast.success(t("toast_delete_success"));
      setSelectedAssignment(null);
      setView("list");
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("toast_delete_failed"));
    } finally {
      setTimeout(() => {
        if (deletingAssignmentIdRef.current === targetId) {
          deletingAssignmentIdRef.current = null;
        }
      }, 3000);
    }
  };

  const handleAddComment = async (assignmentId: string, content: string) => {
    try {
      await addAssignmentComment({
        assignmentId,
        content,
      }).unwrap();
      toast.success(t("toast_comment_add_success"));
      refetchComments();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("toast_comment_add_failed"));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedAssignment) return;
    try {
      await deleteAssignmentComment({
        assignmentId: selectedAssignment._id,
        commentId,
      }).unwrap();
      toast.success(t("toast_comment_del_success"));
    } catch (err: any) {
      toast.error(err?.data?.message || t("toast_comment_del_failed"));
    }
  };

  const handleGradeSubmission = async (
    studentId: string,
    submissionId: string | undefined,
    score: number | undefined,
    feedback: string
  ) => {
    if (!selectedAssignment) return;
    try {
      await gradeSubmission({
        studentId,
        submissionId,
        body: { score, feedback },
        assignmentId: selectedAssignment._id,
      }).unwrap();
      refetchSubmissions();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || t("toast_grade_failed"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
      {view === "list" && (
        <AssignmentList
          assignments={assignments}
          isTeacher={isTeacher}
          onSelect={handleSelectAssignment}
          onCreateClick={() => setView("create")}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
          submissions={submissions}
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
          onGrade={handleGradeSubmission}
          isGrading={isGrading}
          onEditAssignment={() => setView("edit")}
          refetchSubmission={() => {
            if (!isTeacher) {
              try { refetchMySubmission(); } catch (e) {}
            }
          }}
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
    </div>
  );
}