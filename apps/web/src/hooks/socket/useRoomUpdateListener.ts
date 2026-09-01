// hooks/socket/useRoomUpdateListener.ts
import { useEffect, useRef } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRoomCacheManager } from "../useRoomCacheManager";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/lib/redux/store";
import { channelFilesApi } from "@/lib/redux/api/channelFilesApi";
import { assignmentsApi } from "@/lib/redux/api/assignmentsApi";

interface UseRoomUpdateListenerOptions {
  /** Callback khi user hiện tại vừa rời kênh thành công — để component switch sang kênh khác */
  onUserLeftChannel?: (channelId: string) => void;
}

export function useRoomUpdateListener(
  roomId: string,
  userId: string,
  options?: UseRoomUpdateListenerOptions,
) {
  const router = useRouter();
  const t = useTranslations("room");

  const {
    removeMemberFromRoomCache,
    addMemberToRoomCache,
    updateRoomDetailsCache,
    invalidateRoomList,
    invalidateRoom,
  } = useRoomCacheManager();
  const dispatch = useDispatch<AppDispatch>();

  // ─── Stable Refs: cập nhật mỗi render nhưng socket listeners KHÔNG bị re-register ───
  const removeMemberRef = useRef(removeMemberFromRoomCache);
  const addMemberRef = useRef(addMemberToRoomCache);
  const updateRoomRef = useRef(updateRoomDetailsCache);
  const invalidateRoomListRef = useRef(invalidateRoomList);
  const invalidateRoomRef = useRef(invalidateRoom);
  const onUserLeftChannelRef = useRef(options?.onUserLeftChannel);
  const tRef = useRef(t);
  const dispatchRef = useRef(dispatch);
  const userIdRef = useRef(userId);

  useEffect(() => { removeMemberRef.current = removeMemberFromRoomCache; }, [removeMemberFromRoomCache]);
  useEffect(() => { addMemberRef.current = addMemberToRoomCache; }, [addMemberToRoomCache]);
  useEffect(() => { updateRoomRef.current = updateRoomDetailsCache; }, [updateRoomDetailsCache]);
  useEffect(() => { invalidateRoomListRef.current = invalidateRoomList; }, [invalidateRoomList]);
  useEffect(() => { invalidateRoomRef.current = invalidateRoom; }, [invalidateRoom]);
  useEffect(() => { onUserLeftChannelRef.current = options?.onUserLeftChannel; }, [options?.onUserLeftChannel]);
  useEffect(() => { tRef.current = t; }, [t]);
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─── Socket Effect: chỉ re-run khi roomId thay đổi ───
  // KHÔNG có unstable functions trong dep array → listeners được đăng ký một lần
  useEffect(() => {
    if (!roomId) return;

    const joinRoomSocket = () => {
      console.log("[WEB-GLOBAL] [SOCKET] Emitting join_room for roomId:", roomId);
      socket.emit("join_room", roomId);
    };

    // Đăng ký connect handler TRƯỚC khi connect
    socket.on("connect", joinRoomSocket);

    // Nếu đã connected, join ngay lập tức; nếu chưa thì connect
    if (socket.connected) {
      joinRoomSocket();
    } else {
      socket.connect();
    }

    const handleRoomUpdated = (data: any) => {
      if (!data || !data.type) return;
      const currentUserId = userIdRef.current;

      switch (data.type) {
        case "member_removed":
          removeMemberRef.current(data.roomId, data.removedUserId);
          break;

        case "member_left":
          removeMemberRef.current(data.roomId, data.leftUserId);
          invalidateRoomRef.current(roomId);
          invalidateRoomListRef.current();
          break;

        case "member_joined":
          if (data.member) {
            addMemberRef.current(data.roomId, data.member);
            toast.success(`${data.member.displayName} vừa tham gia phòng`);
          }
          break;

        case "ownership_transferred":
          invalidateRoomListRef.current();
          invalidateRoomRef.current(roomId);
          if (data.newOwnerId === currentUserId) {
            toast.success(
              tRef.current("toast_transfer_new_owner", {
                role: "Leader",
                defaultValue: "Bạn đã trở thành Quản lý / Trưởng nhóm mới của phòng!",
              }),
            );
          } else if (data.previousOwnerId !== currentUserId) {
            toast.info(
              tRef.current("toast_transfer_info", {
                defaultValue: "Quyền quản lý phòng vừa được chuyển giao.",
              }),
            );
          }
          break;

        case "channel_member_removed":
          invalidateRoomListRef.current();
          invalidateRoomRef.current(roomId);
          if (data.targetUserId === currentUserId) {
            toast.warning(
              tRef.current("toast_remove_from_private_channel_warning", {
                defaultValue: "Bạn không còn quyền truy cập kênh riêng tư này.",
              }),
            );
          }
          break;

        case "channel_member_left":
          invalidateRoomRef.current(roomId);
          invalidateRoomListRef.current();

          if (data.userId === currentUserId) {
            if (onUserLeftChannelRef.current) {
              onUserLeftChannelRef.current(data.channelId);
            }
            toast.success(
              tRef.current("toast_leave_channel_success", {
                defaultValue: "Bạn đã rời khỏi kênh thành công.",
              }),
            );
          }
          break;

        case "member_role_updated":
          invalidateRoomListRef.current();
          invalidateRoomRef.current(roomId);
          break;

        case "room_renamed":
          updateRoomRef.current(data.roomId, { name: data.name });
          invalidateRoomListRef.current();
          break;

        case "channel_renamed":
          invalidateRoomRef.current(data.roomId);
          invalidateRoomListRef.current();
          break;

        case "channel_file_uploaded":
        case "channel_file_renamed":
        case "channel_file_deleted":
        case "channel_file_pinned":
        case "channel_file_unpinned":
          if (data.channelId) {
            dispatchRef.current(
              channelFilesApi.util.invalidateTags([
                { type: "ChannelFile", id: data.channelId },
              ])
            );
          }
          break;

        default:
          console.warn("Chưa xử lý sự kiện room_updated type:", data.type);
          break;
      }
    };

    const handleSubmissionDeletedGlobal = (data: any) => {
      console.log("[WEB-GLOBAL] Received assignment_submission_deleted event:", data);
      const eventAssignId = String(data?.assignmentId || data?.submission?.assignmentId || "");
      if (eventAssignId) {
        console.log("[WEB-GLOBAL] [CACHE] Updating getMySubmission cache to null for:", eventAssignId);
        dispatchRef.current(
          assignmentsApi.util.updateQueryData("getMySubmission", eventAssignId, () => null)
        );
        dispatchRef.current(
          assignmentsApi.util.updateQueryData("getSubmissions", eventAssignId, (draft) => {
            if (Array.isArray(draft)) {
              return draft.filter(
                (s: any) => s._id !== data?.submissionId && s.studentId !== data?.studentId
              );
            }
            return draft;
          })
        );
      }
      dispatchRef.current(
        assignmentsApi.util.invalidateTags([
          { type: "Submissions", id: "LIST" },
          { type: "Assignments", id: "LIST" },
          ...(eventAssignId ? [{ type: "Submissions" as const, id: `MY_${eventAssignId}` }] : []),
        ])
      );
    };

    socket.on("room_updated", handleRoomUpdated);
    socket.on("assignment_submission_deleted", handleSubmissionDeletedGlobal);

    return () => {
      // Chỉ leave room khi thực sự rời (unmount hoặc roomId thay đổi)
      socket.emit("leave_room", roomId);
      socket.off("connect", joinRoomSocket);
      socket.off("room_updated", handleRoomUpdated);
      socket.off("assignment_submission_deleted", handleSubmissionDeletedGlobal);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
}
