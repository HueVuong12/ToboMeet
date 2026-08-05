import { useState, useEffect } from "react";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { toast } from "sonner";
import {
  useToggleMeetingChatMutation,
  useToggleWaitingRoomStatusMutation,
  useUpdateApprovalPermissionMutation,
} from "@/lib/redux/api/meetingsApi";

// Hook quản lý cài đặt phòng (Chat, Phòng chờ, Quyền duyệt) dùng trong cuộc họp
export function useRoomSettings({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId?: string;
  channelId?: string;
  meetingCode?: string;
}) {
  const { localParticipant } = useLocalParticipant();
  const { metadata: roomMetadata } = useRoomInfo();

  const [toggleChatApi] = useToggleMeetingChatMutation();
  const [toggleWaitingRoomApi] = useToggleWaitingRoomStatusMutation(); // API bật/tắt phòng chờ
  const [updateApprovalPermissionApi] = useUpdateApprovalPermissionMutation(); // Khởi tạo mutation

  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [isWaitingRoomEnabled, setIsWaitingRoomEnabled] = useState(false); // Mặc định tắt phòng chờ

  const [roomType, setRoomType] = useState<"meeting" | "classroom">("meeting");

  // State quản lý quyền duyệt
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
        setApprovalPermission(meta.approvalPermission); // Parse metadata quyền duyệt
      }
      if (typeof meta.roomType === "string") {
        setRoomType(meta.roomType as "meeting" | "classroom");
      }
    } catch (e) {}
  }, [roomMetadata]);

  const canChat = isChatEnabled || isHost;

  // Toggle Chat
  const handleToggleChat = async () => {
    const newState = !isChatEnabled;
    setIsChatEnabled(newState); // Optimistic UI

    // API không trả về roomId và channelId cho người dùng không có trong phòng
    if (!roomId || !channelId || !meetingCode) return;

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

  // Toggle Phòng chờ
  const handleToggleWaitingRoom = async () => {
    const newState = !isWaitingRoomEnabled;
    setIsWaitingRoomEnabled(newState); // Optimistic UI

    // API không trả về roomId và channelId cho người dùng không có trong phòng
    if (!roomId || !channelId || !meetingCode) return;

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

  // Hàm xử lý đổi quyền duyệt
  const handleUpdateApprovalPermission = async (
    permission: "admin_only" | "member_and_admin" | "everyone",
  ) => {
    const oldState = approvalPermission;
    setApprovalPermission(permission); // Optimistic UI

    // API không trả về roomId và channelId cho người dùng không có trong phòng
    if (!roomId || !channelId || !meetingCode) return;

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
    roomType,
    isHost,
    handleToggleChat,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
  };
}
