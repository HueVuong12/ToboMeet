import { useState, useMemo, useEffect } from "react";
import { useGlobalUserSearch } from "./useGlobalUserSearch";
import { Participant } from "livekit-client";
import { useGetRoomMembersQuery } from "../lib/redux/features/rooms/roomsApi";
import { useSendMeetingInviteMutation } from "../lib/redux/features/meetings/meetingsApi";
import { toast } from "../lib/toast";
import { useTranslation } from "react-i18next";
import { useMeetingSessionContext } from "../components/meeting/contexts/MeetingSessionContext";

interface UseMeetingInviteProps {
  meetingCode: string;
  displayParticipants: Participant[];
  isOpen: boolean;
}

export function useMeetingInvite({
  meetingCode,
  displayParticipants,
  isOpen,
}: UseMeetingInviteProps) {
  const { t } = useTranslation();
  const { meetingData } = useMeetingSessionContext();

  const targetRoomId = meetingData?.roomId;

  const [searchQuery, setSearchQuery] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  // Tự động reset text khi Modal đóng
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Gọi API lấy thành viên phòng
  const { data: roomMembers, isLoading: isMembersLoading } =
    useGetRoomMembersQuery(targetRoomId || "", {
      skip: !targetRoomId || !isOpen,
    });

  // Gọi API tìm kiếm toàn cục (hook đã tự động debounce)
  const {
    users: globalUsers,
    isSearching: isGlobalSearchingRaw,
    isLoadingMore,
    isFetching: isGlobalFetching,
    hasNext: hasNextPage,
    debouncedQuery,
    loadMore,
  } = useGlobalUserSearch({
    q: searchQuery,
    skip: !isOpen || searchQuery.trim() === "",
  });

  const [sendInvite] = useSendMeetingInviteMutation();

  // Logic gộp và lọc dữ liệu
  const availableMembersToInvite = useMemo(() => {
    const activeParticipantIds = new Set(
      displayParticipants.map((p) => p.identity),
    );

    if (!debouncedQuery.trim()) {
      return (
        roomMembers?.filter((member) => {
          if (activeParticipantIds.has(member.userId)) return false;
          if (member.status === "removed") return false;
          return true;
        }) || []
      );
    } else {
      return globalUsers
        .filter((user) => !activeParticipantIds.has(user.supabaseId))
        .map((user) => ({
          userId: user.supabaseId,
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          isOutsider: !roomMembers?.some((rm) => rm.userId === user.supabaseId),
        }));
    }
  }, [roomMembers, globalUsers, displayParticipants, debouncedQuery]);

  const isGlobalSearching = isGlobalSearchingRaw && !!searchQuery.trim();
  const isLoading = isMembersLoading || isGlobalSearching;
  const isFetching = isLoadingMore || isGlobalFetching;

  const handleSendInvite = async (userId: string, displayName: string) => {
    setInvitingUserId(userId);
    try {
      await sendInvite({ meetingCode, inviteeId: userId }).unwrap();
      toast.success(t("meeting.invite_member_modal.toast_success", { name: displayName }));
    } catch (error: any) {
      toast.error(error?.data?.message || error?.message || t("meeting.invite_member_modal.toast_error"));
    } finally {
      setInvitingUserId(null);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    isLoading,
    isLoadingMore,
    isFetching,
    hasNextPage,
    availableMembersToInvite,
    invitingUserId,
    handleSendInvite,
    loadMore,
  };
}
