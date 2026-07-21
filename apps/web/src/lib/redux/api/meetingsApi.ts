import {
  MeetingJoinResponse,
  PresignedUploadResponse,
} from "@tobomeet/shared/types";
import { baseApi } from "./baseApi";

export const meetingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    joinMeetingByCode: builder.mutation<
      MeetingJoinResponse,
      { meetingCode: string; displayName?: string }
    >({
      query: ({ meetingCode, displayName }) => ({
        url: `/meetings/join-by-code`,
        method: "POST",
        data: { displayName, meetingCode },
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
  useJoinMeetingByCodeMutation,
  useToggleMeetingChatMutation,
  useGeneratePresignedUploadUrlMutation,
} = meetingsApi;
