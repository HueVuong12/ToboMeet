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
  status: "active" | "locked";
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
  }),
});

export const {
  useGetAdminStatsQuery,
  useGetAdminUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useResetPasswordMutation,
  useDeleteUserMutation,
} = adminApi;
