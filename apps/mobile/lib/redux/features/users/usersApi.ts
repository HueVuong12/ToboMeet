import { PageResponse, UserResponse } from "@tobomeet/shared/types";
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

export type SearchUsersArgs = {
  q: string;
  page: number;
  limit?: number;
};

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<UserResponse, void>({
      query: () => ({
        url: "/users/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),

    // Tìm kiếm toàn cục + phân trang (tuyệt đối không đụng nữa)
    searchUsers: builder.query<PageResponse<UserResponse>, SearchUsersArgs>({
      query: (args) => ({
        url: "/users/search",
        params: args,
      }),

      // Chỉ tạo khoá (Cache Key) dựa trên từ khóa tìm kiếm (q), bỏ qua page và limit
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const queryKey = queryArgs.q || "";
        return `${endpointName}-${queryKey}`;
      },

      // Gộp (Merge) dữ liệu mới vào cache cũ khi cuộn tải thêm
      merge: (currentCache, newItems, { arg }) => {
        if (arg.page === 1) {
          // Nếu gọi lại trang 1 (khi search từ khóa mới hoặc refresh), ghi đè toàn bộ
          return newItems;
        }

        // Nếu gọi các trang tiếp theo, nối (push) thêm dữ liệu vào mảng items cũ
        currentCache.items.push(...newItems.items);

        // Cập nhật lại các thông tin phân trang
        currentCache.page = newItems.page;
        currentCache.hasNext = newItems.hasNext;
        currentCache.total = newItems.total;
        currentCache.totalPages = newItems.totalPages;
      },

      // Bắt buộc gọi lại API khi page thay đổi hoặc từ khóa q thay đổi
      forceRefetch({ currentArg, previousArg }) {
        return (
          currentArg?.page !== previousArg?.page ||
          currentArg?.q !== previousArg?.q
        );
      },

      providesTags: ["UserSearch"],
    }),

    getSessions: builder.query<SessionsResponse, void>({
      query: () => ({
        url: "/users/me/sessions",
        method: "GET",
      }),
      providesTags: ["UserSessions"],
    }),

    getLoggedOutSessions: builder.query<
      { sessions: UserSession[]; total: number; page: number; limit: number },
      { page: number; limit: number }
    >({
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
