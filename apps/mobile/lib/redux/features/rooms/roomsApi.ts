import {
  RoomMemberResponse,
  RoomResponse,
} from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

export const roomsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyRooms: builder.query<RoomResponse[], void>({
      query: () => ({
        url: "/rooms/my",
        method: "GET",
      }),
      providesTags: ["Room"],
    }),

    getRoomById: builder.query<RoomResponse, string>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Room", id }],
    }),

    createRoom: builder.mutation<
      RoomResponse,
      { name: string; type: "meeting" | "classroom" }
    >({
      query: (body) => ({
        url: "/rooms",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Room"],
    }),

    joinRoom: builder.mutation<RoomResponse, { code: string }>({
      query: (body) => ({
        url: "/rooms/join",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Room"],
    }),

    addChannel: builder.mutation<
      RoomResponse,
      { roomId: string; name: string }
    >({
      query: ({ roomId, name }) => ({
        url: `/rooms/${roomId}/channels`,
        method: "POST",
        data: { name },
      }),
      invalidatesTags: (result, error, { roomId }) => [
        { type: "Room", id: roomId },
        "Room",
      ],
    }),

    addMemberByEmailOrId: builder.mutation<
      RoomResponse,
      { roomId: string; email?: string; targetUserId?: string }
    >({
      query: ({ roomId, email, targetUserId }) => ({
        url: `/rooms/${roomId}/members/invite`,
        method: "POST",
        data: { email, targetUserId },
      }),
      invalidatesTags: (result, error, { roomId }) => [
        { type: "Room", id: roomId },
        "Room",
      ],
    }),

    leaveRoom: builder.mutation<void, { roomId: string; newOwnerId?: string }>({
      query: ({ roomId, newOwnerId }) => ({
        url: `/rooms/${roomId}/leave`,
        method: "POST",
        data: { newOwnerId },
      }),
      invalidatesTags: ["Room"],
    }),

    disbandRoom: builder.mutation<void, string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Room"],
    }),

    removeMember: builder.mutation<void, { roomId: string; userId: string }>({
      query: ({ roomId, userId }) => ({
        url: `/rooms/${roomId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { roomId }) => [
        { type: "Room", id: roomId },
        "Room",
      ],
    }),

    getRoomMembers: builder.query<RoomMemberResponse[], string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}/members`,
        method: "GET",
      }),
      providesTags: (result, error, roomId) => [{ type: "Room", id: roomId }],
    }),

    getRoomByCode: builder.query<
      { _id: string; name: string; type: string; code: string },
      string
    >({
      query: (code) => ({
        url: `/rooms/code/${code}`,
        method: "GET",
      }),
    }),

    // Hưng thêm vào, không đụng phần code bên dưới

    /**
     * Kiểm tra trạng thái thành viên bằng ID phòng
     */
    checkMemberById: builder.query<{ isMember: boolean }, string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}/check-member`,
        method: "GET",
      }),
      // Cung cấp tag để có thể tự động gọi lại nếu danh sách phòng thay đổi
      providesTags: (_result, _error, roomId) => [{ type: "Room", id: roomId }],
    }),

    /**
     * Kiểm tra trạng thái thành viên bằng mã code
     */
    checkMemberByCode: builder.query<{ isMember: boolean }, string>({
      query: (code) => ({
        url: `/rooms/code/${code}/check-member`,
        method: "GET",
      }),
    }),
  }),

  overrideExisting: false,
});

export const {
  useGetMyRoomsQuery,
  useGetRoomByIdQuery,
  useCreateRoomMutation,
  useJoinRoomMutation,
  useAddChannelMutation,
  useAddMemberByEmailOrIdMutation,
  useLeaveRoomMutation,
  useDisbandRoomMutation,
  useGetRoomMembersQuery,
  useRemoveMemberMutation,
  useCheckMemberByCodeQuery,
  useCheckMemberByIdQuery,
  useGetRoomByCodeQuery,
} = roomsApi;
