import {
  ActiveMeetingResponse,
  MeetingJoinResponse,
  PresignedUploadResponse,
} from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

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
        data: { displayName, deviceId, forceSwitch },
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
      ActiveMeetingResponse,
      { roomId: string; channelId: string }
    >({
      query: ({ roomId, channelId }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/active`,
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
  useToggleMeetingChatMutation,
  useRemoveParticipantMutation,
  useMuteParticipantMutation,
  useGeneratePresignedUploadUrlMutation,
} = meetingsApi;
