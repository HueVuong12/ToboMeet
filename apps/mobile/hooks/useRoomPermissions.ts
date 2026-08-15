import { useMemo } from "react";
import {
  ChannelResponse,
  RoomMemberResponse,
  RoomResponse,
} from "@tobomeet/shared/types";

export const useRoomPermissions = (
  room: RoomResponse | undefined,
  membersList: RoomMemberResponse[] | undefined,
  currentUserId: string | undefined,
  activeChannelId: string | null,
  targetUserId?: string,
) => {
  return useMemo(() => {
    // 1. Xác định Kênh hiện tại
    const currentChannel =
      room?.channels?.find((c: ChannelResponse) => c._id === activeChannelId) ||
      room?.channels?.[0];

    // 2. Tính toán quyền hạn của người dùng hiện tại (Current User)
    const rawCurrentUserRole =
      room?.members?.find((m: RoomMemberResponse) => m.userId === currentUserId)
        ?.role ||
      membersList?.find((m: RoomMemberResponse) => m.userId === currentUserId)
        ?.role;

    const currentUserRole = rawCurrentUserRole
      ? ["owner", "teacher", "leader"].includes(rawCurrentUserRole.toLowerCase())
        ? "owner"
        : ["vice", "vice_leader", "assistant", "admin"].includes(rawCurrentUserRole.toLowerCase())
          ? "admin"
          : "member"
      : "member";

    const isOwner = !!(
      room &&
      currentUserId &&
      (room.ownerId === currentUserId || currentUserRole === "owner")
    );

    const rawCurrentUserChannelRole = currentChannel?.members?.find(
      (m) => m.userId === currentUserId,
    )?.role;

    const currentUserChannelRole = rawCurrentUserChannelRole
      ? ["owner", "teacher", "leader"].includes(rawCurrentUserChannelRole.toLowerCase())
        ? "owner"
        : ["vice", "vice_leader", "assistant", "admin"].includes(rawCurrentUserChannelRole.toLowerCase())
          ? "admin"
          : "member"
      : "member";

    const isCurrentUserRoomVice =
      !isOwner &&
      (currentUserRole === "admin" ||
        (currentChannel?.isPrivate !== true &&
          currentUserChannelRole === "admin"));

    const canUserManageChannel =
      isOwner ||
      isCurrentUserRoomVice ||
      currentUserChannelRole === "admin";


    // 3. Tính toán quyền hạn của đối tượng đang được thao tác (Target User)
    let isTargetAdmin = false;
    let isTargetRoomVice = false;
    let isTargetRoomLeader = false;

    if (targetUserId) {
      const targetMemberInfo =
        membersList?.find((m) => m.userId === targetUserId) ||
        room?.members?.find((m) => m.userId === targetUserId);

      const targetChannelRole = currentChannel?.members?.find(
        (cm) => cm.userId === targetUserId,
      )?.role;

      isTargetAdmin = targetChannelRole === "admin";
      isTargetRoomVice = targetMemberInfo?.role?.toLowerCase() === "admin";
      isTargetRoomLeader =
        targetMemberInfo?.role?.toLowerCase() === "owner" ||
        targetUserId === room?.ownerId;
    }

    return {
      currentChannel,
      currentUserRole,
      isOwner,
      currentUserChannelRole,
      isCurrentUserRoomVice,
      canUserManageChannel,
      isTargetAdmin,
      isTargetRoomVice,
      isTargetRoomLeader,
    };
  }, [room, membersList, currentUserId, activeChannelId, targetUserId]);
};
