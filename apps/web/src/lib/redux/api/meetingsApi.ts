import {
  MeetingDeviceStatus,
  MeetingJoinResponse,
  PresignedUploadResponse,
  RoomMemberStatus,
} from "@tobomeet/shared/types";
import { baseApi } from "./baseApi";

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
  useRemoveParticipantMutation,
  useApproveParticipantMutation,
  useMuteParticipantMutation,
  useGeneratePresignedUploadUrlMutation,
} = meetingsApi;
