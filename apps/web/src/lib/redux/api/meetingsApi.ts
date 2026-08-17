import {
  LivekitBreakoutRoom,
  MeetingDeviceStatus,
  MeetingJoinResponse,
  PresignedUploadResponse,
  RoomMemberStatus,
} from "@tobomeet/shared/types";
import { baseApi } from "./baseApi";

interface ExchangeSessionResponse {
  meetingCode: string;
  roomId: string;
  channelId: string;
}

export const meetingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    joinMeeting: builder.mutation<
      MeetingJoinResponse,
      {
        roomId: string;
        channelId: string;
        deviceId: string;
        displayName?: string;
        forceSwitch?: boolean;
      }
    >({
      query: ({ roomId, channelId, deviceId, displayName, forceSwitch }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/join`,
        method: "POST",
        data: { displayName, forceSwitch, deviceId },
      }),
    }),

    joinMeetingByCode: builder.mutation<
      MeetingJoinResponse,
      { meetingCode: string; deviceId: string; displayName?: string }
    >({
      query: ({ meetingCode, deviceId, displayName }) => ({
        url: `/meetings/join-by-code`,
        method: "POST",
        data: { displayName, deviceId, meetingCode },
      }),
    }),

    getActiveMeeting: builder.query<
      { isOngoing: boolean; meetingCode: string | null },
      { roomId: string; channelId: string }
    >({
      query: ({ roomId, channelId }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/active`,
        method: "GET",
      }),
    }),

    getDeviceStatus: builder.query<
      MeetingDeviceStatus,
      { roomId: string; channelId: string; deviceId: string }
    >({
      query: ({ roomId, channelId, deviceId }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/devices/${deviceId}`,
        method: "GET",
      }),

      providesTags: (result, error, { roomId, channelId, deviceId }) => [
        {
          type: "DeviceStatus",
          id: `${roomId}-${channelId}-${deviceId}`,
        },
      ],
    }),

    getMemberStatus: builder.query<RoomMemberStatus, { meetingCode: string }>({
      query: ({ meetingCode }) => ({
        url: `meetings/${meetingCode}/member-status`,
        method: "GET",
      }),
    }),

    toggleMeetingChat: builder.mutation<
      void,
      {
        roomId: string;
        channelId: string;
        meetingCode: string;
        isChatEnabled: boolean;
      }
    >({
      query: ({ roomId, channelId, meetingCode, isChatEnabled }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${meetingCode}/chat-status`,
        method: "PUT",
        data: { isChatEnabled },
      }),
    }),

    // Bật/tắt chế độ phòng chờ
    toggleWaitingRoomStatus: builder.mutation<
      void,
      {
        roomId: string;
        channelId: string;
        meetingCode: string;
        isWaitingRoomEnabled: boolean;
      }
    >({
      query: ({ roomId, channelId, meetingCode, isWaitingRoomEnabled }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${meetingCode}/waiting-room-status`,
        method: "PATCH",
        data: { isWaitingRoomEnabled },
      }),
    }),

    // Duyệt người dùng từ phòng chờ vào cuộc họp chính
    approveParticipant: builder.mutation<
      void,
      {
        roomId: string;
        channelId: string;
        code: string;
        identity: string | "all"; // Hỗ trợ duyệt tất cả người chờ bằng cách truyền 'all'
      }
    >({
      query: ({ roomId, channelId, code, identity }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${code}/participants/${identity}/approve`,
        method: "PATCH",
      }),
    }),

    updateApprovalPermission: builder.mutation<
      void,
      {
        roomId: string;
        channelId: string;
        code: string;
        permission: "admin_only" | "member_and_admin" | "everyone";
      }
    >({
      query: ({ roomId, channelId, code, permission }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${code}/approval-permission`,
        method: "PATCH",
        data: { permission },
      }),
    }),

    removeParticipant: builder.mutation<
      void,
      { roomId: string; channelId: string; code: string; identity: string }
    >({
      query: ({ roomId, channelId, code, identity }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${code}/participants/${identity}`,
        method: "DELETE",
      }),
    }),

    muteParticipant: builder.mutation<
      void,
      {
        roomId: string;
        channelId: string;
        code: string;
        identity: string;
        trackType: "audio" | "video";
      }
    >({
      query: ({ roomId, channelId, code, identity, trackType }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${code}/participants/${identity}/mute`,
        method: "PUT",
        data: { trackType },
      }),
    }),

    startScreenShare: builder.mutation<void, { meetingCode: string }>({
      query: ({ meetingCode }) => ({
        url: `/meetings/${meetingCode}/screen-share/start`,
        method: "POST",
      }),
    }),

    stopScreenShare: builder.mutation<void, { meetingCode: string }>({
      query: ({ meetingCode }) => ({
        url: `/meetings/${meetingCode}/screen-share/stop`,
        method: "POST",
      }),
    }),

    generatePresignedUploadUrl: builder.mutation<
      PresignedUploadResponse,
      { fileName: string; meetingCode: string }
    >({
      query: (body) => ({
        url: `/meetings/presigned`,
        method: "POST",
        data: body,
      }),
    }),

    // Gửi lời mời
    sendMeetingInvite: builder.mutation<
      any,
      { meetingCode: string; inviteeId: string }
    >({
      query: ({ meetingCode, inviteeId }) => ({
        url: `/meetings/${meetingCode}/invite`,
        method: "POST",
        data: { inviteeId },
      }),
    }),

    // Đổi sessionId lấy meetingCode
    exchangeSession: builder.query<ExchangeSessionResponse, string>({
      query: (sessionId) => ({
        url: `/meetings/sessions/${sessionId}/exchange`,
        method: "GET",
      }),
    }),

    // ====== Breakout room APIs =======

    // Khởi tạo Breakout Room (Gọi bởi Host)
    startBreakoutSession: builder.mutation<
      void,
      {
        code: string;
        rooms: Omit<LivekitBreakoutRoom, "id">[];
      }
    >({
      query: ({ code, rooms }) => ({
        url: `/meetings/${code}/breakout/start`,
        method: "POST",
        data: { rooms },
      }),
    }),

    // Kết thúc Breakout Room (Gọi bởi Host)
    endBreakoutSession: builder.mutation<void, { code: string }>({
      query: ({ code }) => ({
        url: `/meetings/${code}/breakout/end`,
        method: "POST",
      }),
    }),

    // Xin vào phòng Breakout (Gọi bởi Participant)
    joinBreakoutRoom: builder.mutation<
      MeetingJoinResponse, // Trả về Token và thông tin phòng
      { code: string; breakoutRoomId: string; deviceId: string }
    >({
      query: ({ code, breakoutRoomId, deviceId }) => ({
        url: `/meetings/${code}/breakout/join`,
        method: "POST",
        data: { breakoutRoomId, deviceId },
      }),
    }),

    // Quay lại phòng họp chính (Gọi bởi Participant)
    returnToMainRoom: builder.mutation<
      MeetingJoinResponse,
      { fullBreakoutRoomName: string; deviceId: string }
    >({
      query: ({ fullBreakoutRoomName, deviceId }) => ({
        url: `/meetings/breakout/${fullBreakoutRoomName}/return`,
        method: "POST",
        data: { deviceId },
      }),
    }),
  }),
  overrideExisting: true,
});

export const {
  useJoinMeetingMutation,
  useJoinMeetingByCodeMutation,
  useGetActiveMeetingQuery,
  useGetDeviceStatusQuery,
  useLazyGetMemberStatusQuery,
  useToggleWaitingRoomStatusMutation,
  useToggleMeetingChatMutation,
  useStartScreenShareMutation,
  useStopScreenShareMutation,
  useUpdateApprovalPermissionMutation,
  useRemoveParticipantMutation,
  useApproveParticipantMutation,
  useMuteParticipantMutation,
  useGeneratePresignedUploadUrlMutation,
  useSendMeetingInviteMutation,
  useLazyExchangeSessionQuery,

  // Breakout room
  useStartBreakoutSessionMutation,
  useEndBreakoutSessionMutation,
  useJoinBreakoutRoomMutation,
  useReturnToMainRoomMutation,
} = meetingsApi;
