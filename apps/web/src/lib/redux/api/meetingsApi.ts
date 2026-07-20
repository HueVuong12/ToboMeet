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
  useGeneratePresignedUploadUrlMutation,
} = meetingsApi;
