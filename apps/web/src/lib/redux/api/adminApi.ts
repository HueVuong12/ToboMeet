import { baseApi } from "./baseApi";

export interface AdminStatsResponse {
  totalUsers: number;
  onlineUsers: number;
  activeMeetings: number;
  totalMeetings: number;
  roomsCreatedToday: number;
  averageMeetingDuration: number;
  chartData: { date: string; count: number }[];
  recentRooms: { id: string; name: string; code: string; createdAt: string }[];
  recentMeetings: { id: string; meetingCode: string; status: string; createdAt: string }[];
}

export interface AdminUserResponse {
  id: string;
  supabaseId: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  role: "admin" | "user" | "moderator";
  status: "ACTIVE" | "BLOCKED" | "active" | "locked";
  lockType?: string;
  lockSource?: string;
  lockedAt?: string;
  lockedUntil?: string;
  lockReason?: string;
  lockedBy?: string;
  recommendedDuration?: string;
  actualDuration?: string;
  violationType?: string;
  violationCounts?: Record<string, number>;
  lockHistory?: any[];
  createdAt: string;
  emailWarning?: string;
}

export interface AdminUsersPaginationResponse {
  users: AdminUserResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getAdminStats: builder.query<AdminStatsResponse, void>({
      query: () => ({
        url: "/admin/stats",
        method: "GET",
      }),
    }),
    getAdminUsers: builder.query<AdminUsersPaginationResponse, { query?: string; page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/admin/users",
        method: "GET",
        params: params ? {
          query: params.query || undefined,
          page: params.page || undefined,
          limit: params.limit || undefined,
        } : undefined,
      }),
    }),
    createUser: builder.mutation<AdminUserResponse, Partial<AdminUserResponse> & { password?: string }>({
      query: (data) => ({
        url: "/admin/users",
        method: "POST",
        data,
      }),
    }),
    updateUser: builder.mutation<AdminUserResponse, { id: string; displayName: string; role: string; status: string }>({
      query: ({ id, ...data }) => ({
        url: `/admin/users/${id}`,
        method: "PUT",
        data,
      }),
    }),
    resetPassword: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/admin/users/${id}/reset-password`,
        method: "PUT",
      }),
    }),
    deleteUser: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/admin/users/${id}`,
        method: "DELETE",
      }),
    }),
    lockUser: builder.mutation<
      AdminUserResponse,
      {
        id: string;
        violationType: string;
        recommendedDuration: string;
        actualDuration: string;
        lockReason: string;
        sendEmail: boolean;
        lockSource?: string;
      }
    >({
      query: ({ id, ...data }) => ({
        url: `/admin/users/${id}/lock`,
        method: "POST",
        data,
      }),
    }),
    unlockUser: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/admin/users/${id}/unlock`,
        method: "POST",
      }),
    }),
    extendUserLock: builder.mutation<
      { success: boolean; message: string; emailWarning?: string },
      { id: string; actualDuration: string; lockReason: string }
    >({
      query: ({ id, ...data }) => ({
        url: `/admin/users/${id}/extend-lock`,
        method: "POST",
        data,
      }),
    }),
    getAdminRooms: builder.query<any, any>({
      query: (params) => ({
        url: "/admin/rooms",
        method: "GET",
        params,
      }),
      providesTags: ["Room"],
    }),
    getAdminRoomStats: builder.query<any, void>({
      query: () => ({
        url: "/admin/rooms/stats",
        method: "GET",
      }),
      providesTags: ["Room"],
    }),
    getAdminRoomDetails: builder.query<any, string>({
      query: (id) => ({
        url: `/admin/rooms/${id}`,
        method: "GET",
      }),
      providesTags: ["Room"],
    }),
    disbandRoom: builder.mutation<any, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/admin/rooms/${id}/disband`,
        method: "POST",
        data: { reason },
      }),
      invalidatesTags: ["Room"],
    }),
  }),
});

export const {
  useGetAdminStatsQuery,
  useGetAdminUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResetPasswordMutation,
  useDeleteUserMutation,
  useLockUserMutation,
  useUnlockUserMutation,
  useExtendUserLockMutation,
  useGetAdminRoomsQuery,
  useGetAdminRoomStatsQuery,
  useGetAdminRoomDetailsQuery,
  useDisbandRoomMutation,
} = adminApi;
