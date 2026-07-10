import { Room } from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

export const roomsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyRooms: builder.query<Room[], void>({
      query: () => ({
        url: "/rooms/my",
        method: "GET",
      }),
      providesTags: ["Room"],
    }),
    getRoomById: builder.query<Room, string>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Room", id }],
    }),
    createRoom: builder.mutation<Room, { name: string; type: "meeting" | "classroom" }>({
      query: (body) => ({
        url: "/rooms",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Room"],
    }),
    joinRoom: builder.mutation<Room, { code: string }>({
      query: (body) => ({
        url: "/rooms/join",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Room"],
    }),
    addChannel: builder.mutation<Room, { roomId: string; name: string }>({
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
    addMemberByEmailOrId: builder.mutation<Room, { roomId: string; email?: string; targetUserId?: string }>({
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
    leaveRoom: builder.mutation<any, { roomId: string; newOwnerId?: string }>({
      query: ({ roomId, newOwnerId }) => ({
        url: `/rooms/${roomId}/leave`,
        method: "POST",
        data: { newOwnerId },
      }),
      invalidatesTags: ["Room"],
    }),
    disbandRoom: builder.mutation<any, string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Room"],
    }),
    getRoomMembers: builder.query<any[], string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}/members`,
        method: "GET",
      }),
      providesTags: (result, error, roomId) => [{ type: "Room", id: roomId }],
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
} = roomsApi;
