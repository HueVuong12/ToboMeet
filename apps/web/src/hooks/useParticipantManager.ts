import { useState } from "react";
import { toast } from "sonner";
import {
  useParticipants,
  useLocalParticipant,
  useRoomInfo,
} from "@livekit/components-react";
import { useHandRaise } from "@/hooks/useHandRaise";
import {
  useMuteParticipantMutation,
  useRemoveParticipantMutation,
  useApproveParticipantMutation,
} from "@/lib/redux/api/meetingsApi";

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
  const { metadata: roomMetadata } = useRoomInfo();

  const [removeParticipant] = useRemoveParticipantMutation();
  const [muteParticipantApi] = useMuteParticipantMutation();
  const [approveParticipantApi] = useApproveParticipantMutation(); // Khởi tạo mutation

  const [kickedUsers, setKickedUsers] = useState<string[]>([]);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{
    isOpen: boolean;
    newName: string;
  } | null>(null);

  // Phân tích Role của bản thân
  let localRole = "guest";
  try {
    if (localParticipant.metadata) {
      localRole = JSON.parse(localParticipant.metadata).role || "guest";
    }
  } catch (error) {}
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
  } catch (error) {}

  // AI CÓ QUYỀN DUYỆT?
  let canApprove = false;
  if (isWaitingRoomEnabled) {
    if (isLocalAdmin) {
      canApprove = true; // Admin/Owner luôn có quyền
    } else if (approvalPermission === "everyone") {
      canApprove = true; // Mọi người đều có quyền
    } else if (
      approvalPermission === "member_and_admin" &&
      localRole === "member"
    ) {
      canApprove = true; // Thành viên cũng có quyền
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
    } catch (e) {}
    return false;
  });

  // Lọc ra danh sách ĐÃ VÀO PHÒNG (joined/owner)
  const displayParticipants = participants
    .filter((p) => {
      if (kickedUsers.includes(p.identity)) return false;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          return meta.status !== "waiting"; // Bỏ qua những người đang chờ
        }
      } catch (e) {}
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

  // Hàm duyệt người dùng
  const handleApprove = async (identity: string, name: string) => {
    const isAll = identity === "all";

    toast.promise(
      approveParticipantApi({
        roomId: roomId!,
        channelId: channelId!,
        code: meetingCode!,
        identity,
      }).unwrap(),
      {
        loading: isAll ? "Đang duyệt tất cả..." : `Đang duyệt ${name}...`,
        success: isAll
          ? "Đã duyệt tất cả vào phòng"
          : `Đã duyệt ${name} vào phòng`,
        error: isAll ? "Không thể duyệt tất cả" : "Không thể duyệt người này",
      },
    );
  };

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

  const handleMute = async (
    identity: string,
    name: string,
    trackType: "audio" | "video",
  ) => {
    const typeLabel = trackType === "audio" ? "Mic" : "Camera";

    toast.promise(
      muteParticipantApi({
        roomId: roomId!,
        channelId: channelId!,
        code: meetingCode!,
        identity,
        trackType,
      }).unwrap(),
      {
        loading: `Đang tắt ${typeLabel} của ${name}...`,
        success: `Đã tắt ${typeLabel} của ${name}`,
        error: `Không thể tắt ${typeLabel} lúc này`,
      },
    );
  };

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
    localParticipant,
    displayParticipants, // Những người đã duyệt
    waitingParticipants, // Nhóm Đang chờ
    isLocalAdmin,
    canApprove,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleMute,
    handleRenameSubmit,
    handleApprove,
    getHandState,
  };
}
