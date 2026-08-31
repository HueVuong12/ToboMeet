import React, { useState, useEffect } from "react";
import {
  useGetRoomAssignmentsQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useSubmitAssignmentMutation,
  useGetSubmissionsQuery,
  useGetMySubmissionQuery,
  useGradeSubmissionMutation,
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
}

export default function AssignmentModule({
  roomId,
  userId,
  channels,
  roomMembers,
}: AssignmentModuleProps) {
  const [view, setView] = useState<"list" | "create" | "edit" | "detail" | "grade">("list");
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const { data: assignments = [], isLoading, refetch } = useGetRoomAssignmentsQuery(roomId);

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

  const handleSelectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setView("detail");
  };

  const handleCreateAssignment = async (payload: any) => {
    try {
      if (view === "edit" && selectedAssignment) {
        await updateAssignment({ id: selectedAssignment._id, body: payload }).unwrap();
        toast.success("Cập nhật bài tập thành công!");
      } else {
        await createAssignment(payload).unwrap();
        toast.success(payload.status === "published" ? "Giao bài tập thành công!" : "Lưu bản nháp thành công!");
      }
      setView("list");
      setSelectedAssignment(null);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Đã xảy ra lỗi khi tạo bài tập");
    }
  };

  const handleSubmitAssignment = async (attachments: any[]) => {
    if (!selectedAssignment) return;
    try {
      await submitAssignment({ id: selectedAssignment._id, body: { attachments } }).unwrap();
      toast.success("Nộp bài tập thành công!");
      refetchMySubmission();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Nộp bài thất bại");
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
      toast.error(err?.data?.message || err?.message || "Chấm điểm thất bại");
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {view === "list" && (
        <AssignmentList
          assignments={assignments}
          isTeacher={isTeacher}
          onSelect={handleSelectAssignment}
          onCreateClick={() => setView("create")}
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
          onBack={() => {
            setView("list");
            setSelectedAssignment(null);
          }}
          onSubmit={handleSubmitAssignment}
          isSubmitting={isSubmitting}
          onGradeClick={() => setView("grade")}
          refetchSubmission={refetchMySubmission}
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