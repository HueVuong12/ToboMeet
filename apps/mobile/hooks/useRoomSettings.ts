// hooks/useRoomSettings.ts
import { useState, useEffect } from "react";
import { useLocalParticipant, useRoomInfo } from "@livekit/react-native";
import { toast } from "../lib/toast";
import {
  useEndBreakoutSessionMutation,
  useToggleMeetingChatMutation,
  useToggleWaitingRoomStatusMutation,
  useUpdateApprovalPermissionMutation,
} from "../lib/redux/features/meetings/meetingsApi";
import {
  LivekitBreakoutRoom,
  LivekitRoomMetadata,
  ParticipantMetadata,
} from "@tobomeet/shared/types";
import { useTranslation } from "react-i18next";

export function useRoomSettings({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId?: string;
  channelId?: string;
  meetingCode: string;
}) {
  const { localParticipant } = useLocalParticipant();
  const { metadata: roomMetadata } = useRoomInfo();

  const [toggleChatApi] = useToggleMeetingChatMutation();
  const [toggleWaitingRoomApi] = useToggleWaitingRoomStatusMutation();
  const [updateApprovalPermissionApi] = useUpdateApprovalPermissionMutation();
  const [endBreakoutApi] = useEndBreakoutSessionMutation();

  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [isWaitingRoomEnabled, setIsWaitingRoomEnabled] = useState(false);
  const [approvalPermission, setApprovalPermission] = useState<
    "admin_only" | "member_and_admin" | "everyone"
  >("admin_only");

  const [roomType, setRoomType] = useState<"main" | "breakout">("main");
  const [breakoutRoomsList, setBreakoutRoomsList] = useState<
    LivekitBreakoutRoom[]
  >([]);
  const [isBreakoutActive, setIsBreakoutActive] = useState(false);
  const [breakoutStartedAt, setBreakoutStartedAt] = useState<number>(0);
  const [breakoutDuration, setBreakoutDuration] = useState<number>(0);
  const [roomName, setRoomName] = useState<string>("");

  // Kiểm tra quyền Chủ phòng/Admin
  let isHost = false;
  try {
    if (localParticipant?.metadata) {
      const userMeta: ParticipantMetadata = JSON.parse(
        localParticipant.metadata,
      );
      isHost = userMeta.role === "owner" || userMeta.role === "admin";
    }
  } catch (e) { }

  // Lắng nghe và đồng bộ trạng thái cài đặt chung từ Server (Metadata của LiveKit)
  useEffect(() => {
    if (!roomMetadata) return;
    try {
      const meta: LivekitRoomMetadata = JSON.parse(roomMetadata);

      setRoomName(meta.roomName || "");

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

        setIsChatEnabled(meta.isChatEnabled);
        setIsWaitingRoomEnabled(meta.isWaitingRoomEnabled);
        setApprovalPermission(meta.approvalPermission);

        setIsBreakoutActive(meta.breakoutSession?.status === "active");
        setBreakoutRoomsList(meta.breakoutSession?.rooms || []);
        setBreakoutStartedAt(meta.breakoutSession?.startedAt || 0);
      }
    } catch (e) {
      console.error("Lỗi parse metadata phòng:", e);
    }
  }, [roomMetadata]);

  const canChat = isChatEnabled || isHost;

  const handleToggleChat = async () => {
    const newState = !isChatEnabled;
    setIsChatEnabled(newState); // Optimistic UI

    if (!roomId || !channelId) return; // Không thực hiện nếu không có roomId hoặc channelId

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

    if (!roomId || !channelId) return; // Không thực hiện nếu không có roomId hoặc channelId

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

    if (!roomId || !channelId) return; // Không thực hiện nếu không có roomId hoặc channelId

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

  const { t } = useTranslation();

  const handleEndBreakout = async () => {
    if (!meetingCode) return;
    try {
      await endBreakoutApi({
        code: meetingCode,
      }).unwrap();
      toast.success(
        t("meeting.toolbar.end_breakout_success", {
          defaultValue: "Đã kết thúc phiên thảo luận nhóm",
        }),
      );
    } catch (error: any) {
      console.error("Lỗi khi kết thúc breakout", error);
      toast.error(
        t("meeting.toolbar.end_breakout_error", {
          defaultValue: "Không thể kết thúc thảo luận lúc này.",
        }),
      );
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

