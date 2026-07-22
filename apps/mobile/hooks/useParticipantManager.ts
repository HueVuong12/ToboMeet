import { useState } from "react";
import { Alert } from "react-native";
import { useLocalParticipant, useParticipants } from "@livekit/react-native";
import { Participant } from "livekit-client";
import { useHandRaise } from "./useHandRaise";
import { toast } from "../lib/toast";
import {
  useRemoveParticipantMutation,
  useMuteParticipantMutation, // Nhớ import hàm mutation vừa tạo ở Bước 1
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

  const [removeParticipant] = useRemoveParticipantMutation();
  const [muteParticipant] = useMuteParticipantMutation();

  const [kickedUsers, setKickedUsers] = useState<string[]>([]);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{
    isOpen: boolean;
    newName: string;
  } | null>(null);

  // Kiểm tra quyền (Admin/Owner)
  let localRole = "member";
  try {
    if (localParticipant.metadata) {
      localRole = JSON.parse(localParticipant.metadata).role || "member";
    }
  } catch (e) {
    console.error(e);
  }
  const isLocalAdmin = localRole === "owner" || localRole === "admin";

  // Lọc và sắp xếp người giơ tay
  const displayParticipants = participants
    .filter((p) => !kickedUsers.includes(p.identity))
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
    isLocalAdmin,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    handleMute,
    getHandState,
  };
}
