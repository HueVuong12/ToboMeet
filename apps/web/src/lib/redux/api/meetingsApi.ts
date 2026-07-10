import { MeetingJoinResponse } from "@tobomeet/shared/types";
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
  }),
  overrideExisting: true,
});

export const { useJoinMeetingByCodeMutation } = meetingsApi;
