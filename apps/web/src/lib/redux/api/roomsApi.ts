import { Room } from "@tobomeet/shared/types";
import { baseApi } from "./baseApi";

export const roomsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyRooms: builder.query<Room[], void>({
      query: () => ({
        url: "/rooms/my",
        method: "GET",
      }),
      providesTags: ["Room"],
    }),

    createRoom: builder.mutation<
      Room,
      { name: string; type: "meeting" | "classroom" }
    >({
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

    getRoomById: builder.query<Room, string>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Room", id }],
    }),

    addChannel: builder.mutation<Room, { roomId: string; name: string }>({
      query: ({ roomId, name }) => ({
        url: `/rooms/${roomId}/channels`,
        method: "POST",
        data: { name },
      }),
      invalidatesTags: (_result, _error, { roomId }) => [{ type: "Room", id: roomId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMyRoomsQuery,
  useCreateRoomMutation,
  useJoinRoomMutation,
  useGetRoomByIdQuery,
  useAddChannelMutation,
} = roomsApi;
