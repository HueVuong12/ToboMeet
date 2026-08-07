import { UserResponse } from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

export interface UserSession {
  id: string;
  city?: string;
  country?: string;
  isp?: string;
  ip?: string;
  ipAddress?: string | null;
  deviceName?: string;
  os: string;
  browser: string;
  isMobile: boolean;
  isDesktop: boolean;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  loginMethod?: string;
  loggedOutAt?: string;
}

export interface SessionsResponse {
  currentDevice: UserSession | null;
  otherDevices: UserSession[];
  recentlyLoggedOut: UserSession[];
  totalLoggedOut: number;
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
    getSessions: builder.query<SessionsResponse, void>({
      query: () => ({
        url: "/users/me/sessions",
        method: "GET",
      }),
      providesTags: ["UserSessions"],
    }),
    getLoggedOutSessions: builder.query<{ sessions: UserSession[]; total: number; page: number; limit: number }, { page: number; limit: number }>({
      query: ({ page, limit }) => ({
        url: "/users/me/sessions/logged-out",
        method: "GET",
        params: { page, limit },
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
  useGetLoggedOutSessionsQuery,
  useLazyGetLoggedOutSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useSearchUsersQuery,
} = usersApi;
