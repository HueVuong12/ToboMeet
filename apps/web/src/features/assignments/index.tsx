import React, { useState, useEffect } from "react";
import {
  useGetRoomAssignmentsQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useSubmitAssignmentMutation,
  useGetSubmissionsQuery,
  useGetMySubmissionQuery,
  useGradeSubmissionMutation,
  useDeleteSubmissionMutation,
  useAddSubmissionCommentMutation,
  useGetAssignmentCommentsQuery,
  useAddAssignmentCommentMutation,
} from "@/lib/redux/api/assignmentsApi";
import { Assignment } from "./types";
import AssignmentList from "./components/AssignmentList";
import AssignmentCreate from "./components/AssignmentCreate";
import AssignmentDetail from "./components/AssignmentDetail";
import AssignmentGrading from "./components/AssignmentGrading";
import { Loader2 } from "lucide-react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";

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
  const [view, setView] = useState<"list" | "create" | "edit" | "detail" | "grade">("list");
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
    const handleTrigger = () => {
      setView("create");
    };
    window.addEventListener("trigger-create-assignment", handleTrigger);
    return () => {
      window.removeEventListener("trigger-create-assignment", handleTrigger);
    };
  }, []);

  // Realtime refetch khi giáo viên giao bài mới
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleAssignmentPublished = (data: any) => {
      if (data.roomId === roomId) {
        refetch();
      }
    };

    socket.on("assignment_published", handleAssignmentPublished);

    return () => {
      socket.off("assignment_published", handleAssignmentPublished);
    };
  }, [roomId, refetch]);

  const [createAssignment, { isLoading: isCreating }] = useCreateAssignmentMutation();
  const [updateAssignment, { isLoading: isUpdating }] = useUpdateAssignmentMutation();
  const [submitAssignment, { isLoading: isSubmitting }] = useSubmitAssignmentMutation();
  const [gradeSubmission, { isLoading: isGrading }] = useGradeSubmissionMutation();
  const [deleteSubmission] = useDeleteSubmissionMutation();
  const [addAssignmentComment] = useAddAssignmentCommentMutation();

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

  useEffect(() => {
    if (onViewChange) {
      onViewChange(view);
    }
  }, [view, onViewChange]);

  useEffect(() => {
    const handleTrigger = () => {
      setView("create");
    };
    window.addEventListener("trigger-create-assignment", handleTrigger);
    return () => {
      window.removeEventListener("trigger-create-assignment", handleTrigger);
    };
  }, []);

  // Realtime refetch khi giáo viên giao bài mới hoặc có comment mới
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleAssignmentPublished = (data: any) => {
      if (data.roomId === roomId) {
        refetch();
      }
    };

    const handleCommentAdded = (data: any) => {
      if (selectedAssignment && data.assignmentId === selectedAssignment._id) {
        refetchComments();
      }
    };

    socket.on("assignment_published", handleAssignmentPublished);
    socket.on("assignment_comment_added", handleCommentAdded);

    return () => {
      socket.off("assignment_published", handleAssignmentPublished);
      socket.off("assignment_comment_added", handleCommentAdded);
    };
  }, [roomId, refetch, selectedAssignment, refetchComments]);

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
        await updateAssignment({ id: selectedAssignment._id, body: payload }).unwrap();
        toast.success("Cập nhật nhiệm vụ thành công!");
      } else {
        await createAssignment(payload).unwrap();
        toast.success(payload.status === "published" ? "Giao nhiệm vụ thành công!" : "Lưu bản nháp thành công!");
      }
      setView("list");
      setSelectedAssignment(null);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Đã xảy ra lỗi khi tạo nhiệm vụ");
    }
  };

  const handleSubmitAssignment = async (attachments: any[]) => {
    if (!selectedAssignment) return;
    try {
      await submitAssignment({ id: selectedAssignment._id, body: { attachments } }).unwrap();
      toast.success("Nộp nhiệm vụ thành công!");
      refetchMySubmission();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Nộp nhiệm vụ thất bại");
    }
  };

  const handleDeleteSubmission = async () => {
    if (!selectedAssignment) return;
    try {
      await deleteSubmission(selectedAssignment._id).unwrap();
      toast.success("Hủy nộp nhiệm vụ thành công!");
      refetchMySubmission();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Hủy nộp nhiệm vụ thất bại");
    }
  };

  const handleAddComment = async (assignmentId: string, content: string) => {
    try {
      await addAssignmentComment({
        assignmentId,
        content,
      }).unwrap();
      toast.success("Thêm bình luận thành công!");
      refetchComments();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Thêm bình luận thất bại");
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
      refetchSubmissions();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Đánh giá thất bại");
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
          assignmentToEdit={view === "edit" ? selectedAssignment || undefined : undefined}
          onBack={() => {
            setView("list");
            setSelectedAssignment(null);
          }}
          onSubmit={handleCreateAssignment}
          isSubmitting={isCreating || isUpdating}
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
          refetchSubmission={refetchMySubmission}
          onDeleteSubmission={handleDeleteSubmission}
          onAddComment={handleAddComment}
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