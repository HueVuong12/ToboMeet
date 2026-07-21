import { baseApi } from "./baseApi";

export interface UserSession {
  id: string;
  ip: string;
  location?: string;
  /** Thành phố từ geolocation */
  city?: string;
  /** Quốc gia từ geolocation */
  country?: string;
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
  useSearchUsersQuery,
  useLazySearchUsersQuery,
} = usersApi;
