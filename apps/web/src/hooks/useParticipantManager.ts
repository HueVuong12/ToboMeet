import { useState } from "react";
import { toast } from "sonner";
import {
  useParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import { useRemoveParticipantMutation } from "@/lib/redux/api/roomsApi";
import { useHandRaise } from "@/hooks/useHandRaise";

export function useParticipantManager({
  roomId,
  channelId,
  meetingCode,
}: {
  roomId: string | null;
  channelId: string | null;
  meetingCode: string | null;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { getHandState } = useHandRaise();
  const [removeParticipant] = useRemoveParticipantMutation();

  // State quản lý việc kick và đổi tên
  const [kickedUsers, setKickedUsers] = useState<string[]>([]);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{
    isOpen: boolean;
    newName: string;
  } | null>(null);

  // Phân tích quyền (Admin/Owner)
  let localRole = "member";
  try {
    if (localParticipant.metadata) {
      localRole = JSON.parse(localParticipant.metadata).role || "member";
    }
  } catch (error) {}
  const isLocalAdmin = localRole === "owner" || localRole === "admin";

  // Lọc và sắp xếp người tham gia (ưu tiên giơ tay)
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

  // Xoá người dùng khỏi cuộc họp
  const handleRemove = async (identity: string) => {
    const participant = participants.find((p) => p.identity === identity);
    if (!participant) return;

    toast.warning(
      `Bạn có chắc chắn muốn xoá ${participant.name} khỏi cuộc họp?`,
      {
        action: {
          label: "Xác nhận",
          onClick: async () => {
            setKickingUserId(identity);
            try {
              if (!roomId || !channelId || !meetingCode) {
                toast.error("Chưa thể thực hiện thao tác xoá khỏi phòng!");
                return;
              }

              await removeParticipant({
                roomId,
                channelId,
                code: meetingCode,
                identity,
              }).unwrap();
              setKickedUsers((prev) => [...prev, identity]);
              toast.success(`Đã xoá ${participant.name} khỏi cuộc họp`);
            } catch (error) {
              console.error(error);
              toast.error("Chưa thể thực hiện thao tác xoá khỏi phòng!");
            } finally {
              setKickingUserId(null);
            }
          },
        },
        cancel: {
          label: "Hủy",
          onClick: () => {},
        },
        duration: Infinity,
      },
    );
  };

  // Hàm xử lý đổi tên
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

  return {
    localParticipant, // Người dùng hiện tại (chính mình) trong cuộc họp
    displayParticipants, // Danh sách thành viên đã lọc ra và sắp xếp
    isLocalAdmin,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    getHandState,
  };
}
