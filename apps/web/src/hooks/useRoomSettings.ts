import { useState, useEffect } from "react";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { toast } from "sonner";
import {
  useEndBreakoutSessionMutation,
  useToggleMeetingChatMutation,
  useToggleWaitingRoomStatusMutation,
  useUpdateApprovalPermissionMutation,
} from "@/lib/redux/api/meetingsApi";
import { useTranslations } from "next-intl";
import {
  LivekitBreakoutRoom,
  LivekitRoomMetadata,
  ParticipantMetadata,
} from "@tobomeet/shared/types";

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
  const t = useTranslations("server.errors");
  const tToolbar = useTranslations("meeting.toolbar");
  const tSession = useTranslations("meeting.session");
  const { localParticipant } = useLocalParticipant();
  const { metadata: roomMetadata } = useRoomInfo();

  const [toggleChatApi] = useToggleMeetingChatMutation();
  const [toggleWaitingRoomApi] = useToggleWaitingRoomStatusMutation(); // API bật/tắt phòng chờ
  const [updateApprovalPermissionApi] = useUpdateApprovalPermissionMutation(); // Khởi tạo mutation

  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [isWaitingRoomEnabled, setIsWaitingRoomEnabled] = useState(false); // Mặc định tắt phòng chờ
  const [roomType, setRoomType] = useState<"main" | "breakout">("main");
  const [breakoutRoomsList, setBreakoutRoomsList] = useState<
    LivekitBreakoutRoom[]
  >([]);
  const [isBreakoutActive, setIsBreakoutActive] = useState(false);
  const [endBreakoutApi] = useEndBreakoutSessionMutation();
  const [breakoutStartedAt, setBreakoutStartedAt] = useState<number>(0);
  const [breakoutDuration, setBreakoutDuration] = useState<number>(0);
  const [roomName, setRoomName] = useState<string>("");

  // State quản lý quyền duyệt
  const [approvalPermission, setApprovalPermission] = useState<
    "admin_only" | "member_and_admin" | "everyone"
  >("admin_only");

  // Kiểm tra quyền Chủ phòng/Admin
  let isHost = false;
  try {
    if (localParticipant?.metadata) {
      const userMeta: ParticipantMetadata = JSON.parse(
        localParticipant.metadata,
      );
      isHost = userMeta.role === "owner" || userMeta.role === "admin";
    }
  } catch (e) {}

  // Lắng nghe và đồng bộ trạng thái cài đặt chung từ Server (Metadata của LiveKit)
  useEffect(() => {
    if (!roomMetadata) return;
    try {
      const meta: LivekitRoomMetadata = JSON.parse(roomMetadata);

      setRoomName(meta.roomName);

      if (meta.roomType === "breakout") {
        setRoomType("breakout");
        if (meta.parentMetadata) {
          setIsChatEnabled(meta.parentMetadata.isChatEnabled);
          setApprovalPermission(meta.parentMetadata.approvalPermission);
        }

        setBreakoutStartedAt(meta.startedAt || 0);
        setBreakoutDuration(meta.durationMinutes || 0);
        setIsWaitingRoomEnabled(false);
      } else {
        setRoomType("main");

        // Cập nhật cài đặt của phòng họp
        setIsChatEnabled(meta.isChatEnabled);
        setIsWaitingRoomEnabled(meta.isWaitingRoomEnabled);
        setApprovalPermission(meta.approvalPermission);

        // Cập nhật trạng thái và danh sách nhóm thảo luận (Breakout)
        setIsBreakoutActive(meta.breakoutSession?.status === "active");
        setBreakoutRoomsList(meta.breakoutSession?.rooms || []);
        setBreakoutStartedAt(meta.breakoutSession?.startedAt || 0);
      }
    } catch (e) {
      console.error("Lỗi parse metadata phòng:", e);
    }
  }, [roomMetadata]);

  const canChat = isChatEnabled || isHost;

  // Toggle Chat
  const handleToggleChat = async () => {
    const newState = !isChatEnabled;
    setIsChatEnabled(newState);

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
      if (error?.code) {
        const errorCode = String(error.code);
        toast.error(t(errorCode) || t("5011"));
      } else toast.error(tSession("general_action_error"));
      setIsChatEnabled(!newState); // Rollback nếu lỗi
    }
  };

  // Toggle Phòng chờ
  const handleToggleWaitingRoom = async () => {
    const newState = !isWaitingRoomEnabled;
    setIsWaitingRoomEnabled(newState);

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
      if (error?.code) {
        const errorCode = String(error.code);
        toast.error(t(errorCode) || t("5011"));
      } else toast.error(tSession("general_action_error"));
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
      if (error?.code) {
        const errorCode = String(error.code);
        toast.error(t(errorCode) || t("5011"));
      } else toast.error(tSession("general_action_error"));
      setApprovalPermission(oldState); // Rollback
    }
  };

  const handleEndBreakout = async () => {
    if (!roomId || !channelId || !meetingCode) return;
    try {
      await endBreakoutApi({
        code: meetingCode,
      }).unwrap();
    } catch (error: any) {
      console.error("Lỗi khi kết thúc breakout", error);
      if (error?.code) {
        toast.error(t(String(error.code)) || tToolbar("end_breakout_error"));
      } else {
        toast.error(tToolbar("end_breakout_error"));
      }
    }
  };

  return {
    isChatEnabled,
    canChat,
    isWaitingRoomEnabled,
    approvalPermission,
    isBreakoutActive,
    breakoutRoomsList,
    breakoutDuration,
    breakoutStartedAt,
    isHost,
    roomType,
    roomName,

    handleToggleChat,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
    handleEndBreakout,
  };
}
