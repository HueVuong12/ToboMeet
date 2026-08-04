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

export function useParticipantManager({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string;
  channelId: string;
  meetingCode: string;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { getHandState } = useHandRaise();
  const { metadata: roomMetadata } = useRoomInfo();

  const [removeParticipant] = useRemoveParticipantMutation();
  const [muteParticipant] = useMuteParticipantMutation();
  const [approveParticipantApi] = useApproveParticipantMutation();

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
  const isLocalAdmin = localRole === "owner" || localRole === "admin";

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

  // AI CÓ QUYỀN DUYỆT?
  let canApprove = false;
  if (isWaitingRoomEnabled) {
    if (isLocalAdmin) {
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
    const isAll = identity === "all";

    try {
      toast.success(isAll ? "Đang duyệt tất cả..." : `Đang duyệt ${name}...`);
      await approveParticipantApi({
        roomId,
        channelId,
        code: meetingCode,
        identity,
      }).unwrap();
    } catch (error) {
      console.error("Lỗi duyệt người dùng:", error);
      toast.error(
        isAll ? "Không thể duyệt tất cả" : "Không thể duyệt người này",
      );
    }
  };

  // Xử lý Đuổi
  const handleRemove = (participant: Participant) => {
    Alert.alert(
      "Xác nhận",
      `Bạn có chắc chắn muốn đuổi ${participant.name} khỏi cuộc họp?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đuổi",
          style: "destructive",
          onPress: async () => {
            setKickingUserId(participant.identity);
            try {
              await removeParticipant({
                roomId,
                channelId,
                code: meetingCode,
                identity: participant.identity,
              }).unwrap();
              setKickedUsers((prev) => [...prev, participant.identity]);
            } catch (error) {
              console.error(error);
              Alert.alert(
                "Lỗi",
                "Không thể thực hiện thao tác đuổi khỏi phòng!",
              );
            } finally {
              setKickingUserId(null);
            }
          },
        },
      ],
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
      toast.error("Không thể đổi tên lúc này!");
    }
  };

  // Xử lý Tắt Mic/Cam
  const handleMute = async (
    identity: string,
    name: string,
    trackType: "audio" | "video",
  ) => {
    const typeLabel = trackType === "audio" ? "Mic" : "Camera";
    try {
      toast.success(`Đang tắt ${typeLabel} của ${name}...`);
      await muteParticipant({
        roomId,
        channelId,
        code: meetingCode,
        identity,
        trackType,
      }).unwrap();
    } catch (error) {
      console.error(error);
      toast.error(`Không thể tắt ${typeLabel} lúc này`);
    }
  };

  return {
    localParticipant,
    displayParticipants,
    waitingParticipants,
    canApprove,
    isLocalAdmin,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    handleMute,
    handleApprove,
    getHandState,
  };
}
