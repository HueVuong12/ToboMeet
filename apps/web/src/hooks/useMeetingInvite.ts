import { useState, useMemo, useEffect } from "react";
import { useGetRoomMembersQuery } from "@/lib/redux/api/roomsApi";
import { useSendMeetingInviteMutation } from "@/lib/redux/api/meetingsApi";
import { useGlobalUserSearch } from "./useGlobalUserSearch";
import { toast } from "sonner";
import { Participant } from "livekit-client";
import debounce from "lodash/debounce";

import { useTranslations } from "next-intl";
import { useMeetingSessionContext } from "@/components/meeting/contexts/MeetingSessionContext";

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
  const t = useTranslations("meeting.invite_member_modal");
  const tServer = useTranslations("server.errors");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const { meetingData } = useMeetingSessionContext();

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
    useGetRoomMembersQuery(meetingData?.roomId || "", {
      skip: !meetingData || !meetingData.roomId || !isOpen,
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
      toast.success(
        t("invite_success", {
          name: displayName,
          defaultValue: `Đã gửi lời mời đến ${displayName}`,
        }),
      );
    } catch (error: any) {
      const msg =
        (error?.code && tServer(String(error.code))) ||
        error?.data?.message ||
        error?.message ||
        t("invite_error", {
          defaultValue: "Không thể gửi lời mời lúc này.",
        });
      toast.error(msg);
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
