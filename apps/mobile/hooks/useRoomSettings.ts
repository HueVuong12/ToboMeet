// hooks/useRoomSettings.ts
import { useState, useEffect } from "react";
import { useLocalParticipant, useRoomInfo } from "@livekit/react-native";
import { toast } from "../lib/toast";
import {
  useToggleMeetingChatMutation,
  useToggleWaitingRoomStatusMutation,
  useUpdateApprovalPermissionMutation,
} from "../lib/redux/features/meetings/meetingsApi"; // Đảm bảo import đúng đường dẫn API của bạn

export function useRoomSettings({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string;
  channelId: string;
  meetingCode: string;
}) {
  const { localParticipant } = useLocalParticipant();
  const { metadata: roomMetadata } = useRoomInfo();

  const [toggleChatApi] = useToggleMeetingChatMutation();
  const [toggleWaitingRoomApi] = useToggleWaitingRoomStatusMutation();
  const [updateApprovalPermissionApi] = useUpdateApprovalPermissionMutation();

  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [isWaitingRoomEnabled, setIsWaitingRoomEnabled] = useState(false);
  const [approvalPermission, setApprovalPermission] = useState<
    "admin_only" | "member_and_admin" | "everyone"
  >("admin_only");

  // Kiểm tra quyền Chủ phòng/Admin
  let isHost = false;
  try {
    if (localParticipant?.metadata) {
      const userMeta = JSON.parse(localParticipant.metadata);
      isHost =
        userMeta.hasAdminPowers === true ||
        userMeta.role === "owner" ||
        userMeta.role === "admin";
    }
  } catch (e) {}

  // Lắng nghe và đồng bộ trạng thái cài đặt chung từ Server (Metadata của LiveKit)
  useEffect(() => {
    if (!roomMetadata) return;
    try {
      const meta = JSON.parse(roomMetadata);
      if (typeof meta.isChatEnabled === "boolean") {
        setIsChatEnabled(meta.isChatEnabled);
      }
      if (typeof meta.isWaitingRoomEnabled === "boolean") {
        setIsWaitingRoomEnabled(meta.isWaitingRoomEnabled);
      }
      if (typeof meta.approvalPermission === "string") {
        setApprovalPermission(meta.approvalPermission);
      }
    } catch (e) {}
  }, [roomMetadata]);

  const canChat = isChatEnabled || isHost;

  const handleToggleChat = async () => {
    const newState = !isChatEnabled;
    setIsChatEnabled(newState); // Optimistic UI

    try {
      await toggleChatApi({
        roomId,
        channelId,
        meetingCode,
        isChatEnabled: newState,
      }).unwrap();
    } catch (error: any) {
      if (error?.code === 4032 || error?.status === 403) {
        toast.error("Bạn không đủ quyền thực hiện chức năng này");
      } else toast.error("Chưa thể thực hiện thao tác này");
      setIsChatEnabled(!newState); // Rollback nếu lỗi
    }
  };

  const handleToggleWaitingRoom = async () => {
    const newState = !isWaitingRoomEnabled;
    setIsWaitingRoomEnabled(newState); // Optimistic UI

    try {
      await toggleWaitingRoomApi({
        roomId,
        channelId,
        meetingCode,
        isWaitingRoomEnabled: newState,
      }).unwrap();
    } catch (error: any) {
      if (error?.code === 4032 || error?.status === 403) {
        toast.error("Bạn không đủ quyền thực hiện chức năng này");
      } else toast.error("Chưa thể thực hiện thao tác này");
      setIsWaitingRoomEnabled(!newState); // Rollback nếu lỗi
    }
  };

  const handleUpdateApprovalPermission = async (
    permission: "admin_only" | "member_and_admin" | "everyone",
  ) => {
    const oldState = approvalPermission;
    setApprovalPermission(permission); // Optimistic UI

    try {
      await updateApprovalPermissionApi({
        roomId,
        channelId,
        code: meetingCode,
        permission: permission,
      }).unwrap();
    } catch (error: any) {
      if (error?.code === 4032 || error?.status === 403) {
        toast.error("Bạn không đủ quyền thực hiện chức năng này");
      } else toast.error("Chưa thể thực hiện thao tác này");
      setApprovalPermission(oldState); // Rollback
    }
  };

  return {
    isChatEnabled,
    canChat,
    isWaitingRoomEnabled,
    approvalPermission,
    isHost,
    handleToggleChat,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
  };
}
