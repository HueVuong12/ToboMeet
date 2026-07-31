import { baseApi } from "./baseApi";

export interface UserSession {
  id: string;
  ip: string;
  location?: string;
  /** Thành phố từ geolocation */
  city?: string;
  /** Quốc gia từ geolocation */
  country?: string;
  /** Nhà mạng ISP từ geolocation */
  isp?: string;
  /** IP thật thu nhận được (hoặc null nếu không có) */
  ipAddress?: string | null;
  isGps?: boolean;
  os: string;
  browser: string;
  deviceName: string;
  loginMethod: string;
  isMobile: boolean;
  isDesktop: boolean;
  isCurrent: boolean;
  isFamiliar: boolean;
  createdAt: string;
  updatedAt: string;
  loggedOutAt?: string;
}


export interface SessionsResponse {
  currentDevice: UserSession;
  otherDevices: UserSession[];
  recentlyLoggedOut: UserSession[];
  totalLoggedOut: number;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSessions: builder.query<SessionsResponse, void>({
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

    revokeOtherSessions: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: "/users/me/sessions/others",
        method: "DELETE",
      }),
      invalidatesTags: ["UserSessions"],
    }),

    updateCurrentSessionLocation: builder.mutation<void, { city: string; country: string }>({
      query: (data) => ({
        url: "/users/me/sessions/current/location",
        method: "PUT",
        data,
      }),
      invalidatesTags: ["UserSessions"],
    }),

    searchUsers: builder.query<any[], string>({
      query: (query) => ({
        url: "/users/search",
        method: "GET",
        params: { q: query },
      }),
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useUpdateCurrentSessionLocationMutation,
  useSearchUsersQuery,
  useLazySearchUsersQuery,
} = usersApi;
