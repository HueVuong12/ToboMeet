import { UserResponse } from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

export interface UserSession {
  id: string;
  city?: string;
  country?: string;
  isp?: string;
  ip?: string;
  ipAddress?: string | null;
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
    getSessions: builder.query<UserSession[], void>({
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
    revokeOtherSessions: builder.mutation<void, { socketId?: string } | void>({
      query: (arg) => {
        const socketId = arg && (arg as { socketId?: string }).socketId;
        return {
          url: "/users/me/sessions/others",
          method: "DELETE",
          ...(socketId ? { headers: { "X-Socket-Id": socketId } } : {}),
        };
      },
      invalidatesTags: ["UserSessions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMeQuery,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useSearchUsersQuery,
} = usersApi;
