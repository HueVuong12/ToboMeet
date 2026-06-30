import { baseApi } from "./baseApi";

export interface UserSession {
  id: string;
  ip: string;
  os: string;
  browser: string;
  isMobile: boolean;
  isDesktop: boolean;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSessions: builder.query<UserSession[], void>({
      query: () => ({
        url: "/users/me/sessions",
        method: "GET",
      }),
      providesTags: ["UserSessions"],
    }),

    revokeSession: builder.mutation<{ success: boolean; message: string }, string>({
      query: (sessionId) => ({
        url: `/users/me/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["UserSessions"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetSessionsQuery, useRevokeSessionMutation } = usersApi;
