// hooks/useParticipantManager.ts
import { useState } from "react";
import { Alert } from "react-native";
import {
  useLocalParticipant,
  useParticipants,
  useRoomInfo,
} from "@livekit/react-native";
import { Participant } from "livekit-client";
import { useHandRaise } from "./useHandRaise";
import { toast } from "../lib/toast";
import {
  useRemoveParticipantMutation,
  useMuteParticipantMutation,
  useApproveParticipantMutation,
} from "../lib/redux/features/meetings/meetingsApi";
import {
  useTransferRoomOwnershipMutation,
  useUpdateChannelMemberRoleMutation,
} from "../lib/redux/features/rooms/roomsApi";
import { useTranslation } from "react-i18next";

export function useParticipantManager({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId?: string;
  channelId?: string;
  meetingCode?: string;
}) {
  const { t } = useTranslation();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { getHandState } = useHandRaise();
  const { metadata: roomMetadata } = useRoomInfo();

  const [removeParticipant] = useRemoveParticipantMutation();
  const [muteParticipant] = useMuteParticipantMutation();
  const [approveParticipantApi] = useApproveParticipantMutation();
  const [updateRoleApi] = useUpdateChannelMemberRoleMutation();
  const [transferOwnership] = useTransferRoomOwnershipMutation();

  const [kickedUsers, setKickedUsers] = useState<string[]>([]);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{
    isOpen: boolean;
    newName: string;
  } | null>(null);

  // Phân tích Role của bản thân (Tương tự Web)
  let localRole = "guest";
  try {
    if (localParticipant.metadata) {
      localRole = JSON.parse(localParticipant.metadata).role || "guest";
    }
  } catch (error) {
    console.error("Lỗi phân tích Role của bản thân:", error);
  }
  const canManageParticipants = localRole === "owner" || localRole === "admin";
  const isLocalAdmin = localRole === "admin";
  const isLocalOwner = localRole === "owner";

  // Phân tích Quyền Duyệt từ Room Metadata
  let approvalPermission = "admin_only";
  let isWaitingRoomEnabled = false;
  try {
    if (roomMetadata) {
      const roomMeta = JSON.parse(roomMetadata);
      approvalPermission = roomMeta.approvalPermission || "admin_only";
      isWaitingRoomEnabled = roomMeta.isWaitingRoomEnabled === true;
    }
  } catch (error) {
    console.error("Lỗi phân tích Room Metadata:", error);
  }

  const roleName = t("meeting.member_modal.role_leader", { defaultValue: "Trưởng nhóm" });

  // AI CÓ QUYỀN DUYỆT?
  let canApprove = false;
  if (isWaitingRoomEnabled) {
    if (canManageParticipants) {
      canApprove = true;
    } else if (approvalPermission === "everyone") {
      canApprove = true;
    } else if (
      approvalPermission === "member_and_admin" &&
      localRole === "member"
    ) {
      canApprove = true;
    }
  }

  // Lọc ra danh sách ĐANG CHỜ (waiting)
  const waitingParticipants = participants.filter((p) => {
    if (kickedUsers.includes(p.identity)) return false;
    try {
      if (p.metadata) {
        const meta = JSON.parse(p.metadata);
        return meta.status === "waiting";
      }
    } catch (e) {
      console.error("Lỗi phân tích metadata của người tham gia:", e);
    }
    return false;
  });

  // Lọc ra danh sách ĐÃ VÀO PHÒNG (joined/owner)
  const displayParticipants = participants
    .filter((p) => {
      if (kickedUsers.includes(p.identity)) return false;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          return meta.status !== "waiting";
        }
      } catch (e) {
        console.error("Lỗi phân tích metadata của người tham gia:", e);
      }
      return true;
    })
    .sort((a, b) => {
      const stateA = getHandState(a);
      const stateB = getHandState(b);

      if (stateA.isRaised && stateB.isRaised) {
        return parseInt(stateA.raisedAt) - parseInt(stateB.raisedAt);
      }
      if (stateA.isRaised) return -1;
      if (stateB.isRaised) return 1;
      return 0;
    });

  // Hàm duyệt người dùng (Dùng toast của React Native)
  const handleApprove = async (identity: string, name: string) => {
    if (!meetingCode) return;
    const isAll = identity === "all";

    try {
      toast.success(
        isAll ? t("meeting.member_modal.approve_all_loading") : t("meeting.member_modal.approve_loading", { name: name }),
      );
      await approveParticipantApi({
        code: meetingCode,
        identity,
      }).unwrap();
    } catch (error) {
      console.error("Lỗi duyệt người dùng:", error);
      toast.error(isAll ? t("meeting.member_modal.approve_all_error") : t("meeting.member_modal.approve_error"));
    }
  };

  // Xử lý Đuổi
  const handleRemove = (participant: Participant) => {
    if (!meetingCode) return;
    Alert.alert(t("meeting.member_modal.confirm"), t("meeting.member_modal.remove_confirm", { name: participant.name }), [
      { text: t("meeting.member_modal.cancel"), style: "cancel" },
      {
        text: t("meeting.member_modal.confirm"),
        style: "destructive",
        onPress: async () => {
          setKickingUserId(participant.identity);
          try {
            await removeParticipant({
              code: meetingCode,
              identity: participant.identity,
            }).unwrap();
            setKickedUsers((prev) => [...prev, participant.identity]);
          } catch (error) {
            console.error(error);
            Alert.alert(t("meeting.member_modal.error"), t("meeting.member_modal.remove_error"));
          } finally {
            setKickingUserId(null);
          }
        },
      },
    ]);
  };

  const handleUpdateRole = async (
    targetUserId: string,
    role: "admin" | "member",
  ) => {
    if (!channelId || !roomId) return;

    try {
      await updateRoleApi({
        roomId: roomId,
        channelId: channelId,
        targetUserId: targetUserId,
        role,
      }).unwrap();

      if (role === "admin") {
        toast.success(
          t("meeting.member_modal.toast_appoint_vice_leader_success", {
            defaultValue: "Bổ nhiệm Phó nhóm thành công",
          }),
        );
      } else {
        toast.success(
          t("meeting.member_modal.toast_revoke_vice_leader_success", {
            defaultValue: "Đã thu hồi Phó nhóm",
          }),
        );
      }
    } catch (err: any) {
      if (role === "admin") {
        const subTitle = t("meeting.member_modal.role_vice_leader");
        toast.error(
          err?.data?.message ||
            t("meeting.member_modal.toast_max_vice_leaders_reached", {
              role: subTitle,
              defaultValue: `Đã đạt số lượng tối đa 3 ${subTitle}`,
            }),
        );
      } else {
        toast.error(err?.data?.message || "Không thể thu hồi quyền");
      }
    }
  };

  const handleTransferOwnership = (
    targetUserId: string,
    targetUserName: string,
  ) => {
    if (!channelId || !roomId) return;

    Alert.alert(
      t("meeting.member_modal.transfer_modal_title", {
        defaultValue: "Xác nhận chuyển quyền",
      }),
      t("meeting.member_modal.transfer_confirm_message", {
        role: roleName,
        name: targetUserName,
        defaultValue: `Bạn có chắc chắn muốn chuyển quyền ${roleName} cho ${targetUserName}?`,
      }),
      [
        {
          text: t("meeting.member_modal.cancel", { defaultValue: "Hủy" }),
          style: "cancel",
        },
        {
          text: t("meeting.member_modal.confirm", { defaultValue: "Xác nhận" }),
          style: "destructive",
          onPress: async () => {
            try {
              await transferOwnership({
                roomId,
                newOwnerId: targetUserId,
              }).unwrap();

              toast.success(
                t("meeting.member_modal.toast_transfer_success", {
                  defaultValue: "Chuyển quyền thành công!",
                }),
              );
            } catch (err: any) {
              console.error("[TransferOwnership] Transfer error:", err);

              const msg =
                err?.data?.message ||
                err?.message ||
                "Không thể chuyển quyền. Vui lòng thử lại.";

              toast.error(msg);
            }
          },
        },
      ],
      {
        cancelable: true,
      },
    );
  };

  // Xử lý Đổi tên
  const handleRenameSubmit = async () => {
    if (!renameState || !renameState.newName.trim()) return;
    try {
      await localParticipant.setName(renameState.newName.trim());
      setRenameState(null);
    } catch (error) {
      console.error(error);
      toast.error(t("meeting.member_modal.rename_error"));
    }
  };

  // Xử lý Tắt Mic/Cam
  const handleMute = async (
    identity: string,
    name: string,
    trackType: "audio" | "video",
  ) => {
    if (!meetingCode) return;
    const typeLabel = trackType === "audio" ? "Mic" : "Camera";
    try {
      toast.success(
        t("meeting.member_modal.mute_loading", {
          type: typeLabel,
          name: name,
        }),
      );
      await muteParticipant({
        code: meetingCode,
        identity,
        trackType,
      }).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(
        t("meeting.member_modal.mute_error", {
          type: typeLabel,
        }),
      );
    }
  };

  return {
    localParticipant,
    displayParticipants,
    waitingParticipants,
    canApprove,
    canManageParticipants,
    isLocalAdmin,
    isLocalOwner,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    handleMute,
    handleUpdateRole,
    handleTransferOwnership,
    handleApprove,
    getHandState,
  };
}
