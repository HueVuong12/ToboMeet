import { UserResponse } from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<UserResponse, void>({
      query: () => ({
        url: "/users/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),
    searchUsers: builder.query<UserResponse[], string>({
      query: (query) => ({
        url: `/users/search?q=${encodeURIComponent(query)}`,
        method: "GET",
      }),
    }),
    getSessions: builder.query<any[], void>({
      query: () => ({
        url: "/users/me/sessions",
        method: "GET",
      }),
      providesTags: ["UserSessions"],
    }),
    revokeSession: builder.mutation<void, string>({
      query: (sessionId) => ({
        url: `/users/me/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["UserSessions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMeQuery,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useSearchUsersQuery,
} = usersApi;
