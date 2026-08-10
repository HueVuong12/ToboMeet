// hooks/useMeetingInvite.ts
import { useState } from "react";
import { useGetRoomMembersQuery } from "@/lib/redux/api/roomsApi";
import { useSendMeetingInviteMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";
import { Participant } from "livekit-client"; // Hoặc import type phù hợp từ thư viện bạn dùng

interface UseMeetingInviteProps {
  roomId: string | null;
  meetingCode: string;
  displayParticipants: Participant[]; // Danh sách đang ở trong phòng để lọc
}

export function useMeetingInvite({
  roomId,
  meetingCode,
  displayParticipants,
}: UseMeetingInviteProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  // RTK Queries
  const { data: roomMembers, isLoading: isMembersLoading } =
    useGetRoomMembersQuery(roomId || "", {
      skip: !roomId || !isInviteModalOpen,
    });
  const [sendInvite] = useSendMeetingInviteMutation();

  // Logic lọc thành viên
  const availableMembersToInvite = roomMembers?.filter((member) => {
    const isAlreadyInRoom = displayParticipants.some(
      (p) => p.identity === member.userId,
    );
    if (isAlreadyInRoom) return false;
    if (member.status === "removed") return false;

    if (searchMemberQuery) {
      const q = searchMemberQuery.toLowerCase();
      return (
        member.displayName?.toLowerCase().includes(q) ||
        member.email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Action Gửi lời mời
  const handleSendInvite = async (userId: string, displayName: string) => {
    setInvitingUserId(userId);
    try {
      await sendInvite({ meetingCode, inviteeId: userId }).unwrap();
      toast.success(`Đã gửi lời mời đến ${displayName}`);
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          error?.message ||
          "Không thể gửi lời mời lúc này.",
      );
    } finally {
      setInvitingUserId(null);
    }
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setSearchMemberQuery("");
  };

  return {
    // Trạng thái Modal
    isInviteModalOpen,
    setIsInviteModalOpen,
    closeInviteModal,

    // Trạng thái Tìm kiếm
    searchMemberQuery,
    setSearchMemberQuery,

    // Dữ liệu và Loading
    isMembersLoading,
    availableMembersToInvite,
    invitingUserId,

    // Actions
    handleSendInvite,
  };
}
