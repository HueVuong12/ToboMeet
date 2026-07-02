import {
  RoomResponse,
  RoomMemberResponse,
  MeetingJoinResponse,
} from "@tobomeet/shared/types";
import { baseApi } from "./baseApi";

export const roomsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyRooms: builder.query<RoomResponse[], void>({
      query: () => ({
        url: "/rooms/my",
        method: "GET",
      }),
      providesTags: ["Room"],
    }),

    getRoomMembers: builder.query<RoomMemberResponse[], string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}/members`,
        method: "GET",
      }),
      providesTags: (_result, _error, roomId) => [{ type: "Room", id: roomId }],
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

    getRoomById: builder.query<RoomResponse, string>({
      query: (id) => ({
        url: `/rooms/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Room", id }],
    }),

    joinMeeting: builder.mutation<
      MeetingJoinResponse,
      { roomId: string; channelId: string; displayName?: string }
    >({
      query: ({ roomId, channelId, displayName }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/join`,
        method: "POST",
        data: { displayName },
      }),
    }),

    removeParticipant: builder.mutation<
      void,
      { roomId: string; channelId: string; code: string; identity: string }
    >({
      query: ({ roomId, channelId, code, identity }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/${code}/participants/${identity}`,
        method: "DELETE",
      }),
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
      invalidatesTags: (_result, _error, { roomId }) => [
        { type: "Room", id: roomId },
      ],
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
  useGetRoomMembersQuery,
  useJoinMeetingMutation,
  useRemoveParticipantMutation,
} = roomsApi;
