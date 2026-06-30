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
  }),
  overrideExisting: false,
});

export const {
  useGetMyRoomsQuery,
  useGetRoomByIdQuery,
  useCreateRoomMutation,
  useJoinRoomMutation,
  useAddChannelMutation,
} = roomsApi;
