import { useState, useMemo, useEffect } from "react";
import { useGlobalUserSearch } from "./useGlobalUserSearch";
import { Participant } from "livekit-client";
import debounce from "lodash/debounce";
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  // Debounce logic
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setDebouncedQuery(query);
      }, 500),
    [],
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // Tự động reset bộ đếm và text khi Modal đóng
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedQuery("");
    }
  }, [isOpen]);

  // Gọi API lấy thành viên phòng
  const { data: roomMembers, isLoading: isMembersLoading } =
    useGetRoomMembersQuery(targetRoomId || "", {
      skip: !targetRoomId || !isOpen,
    });

  // Gọi API tìm kiếm toàn cục
  const {
    users: globalUsers,
    isFetching: isGlobalSearching,
    isLoading: isGlobalLoading,
    hasNext: hasNextPage,
    loadMore,
  } = useGlobalUserSearch({
    q: debouncedQuery,
    skip: !isOpen || debouncedQuery.trim() === "",
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

  const isLoading =
    isMembersLoading || (isGlobalLoading && !!debouncedQuery.trim());
  const isFetching = isGlobalSearching;

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
    isFetching,
    hasNextPage,
    availableMembersToInvite,
    invitingUserId,
    handleSendInvite,
    loadMore,
  };
}
