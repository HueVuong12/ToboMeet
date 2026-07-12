import {
  ActiveMeetingResponse,
  MeetingJoinResponse,
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

    getRoomMembers: builder.query<RoomMemberResponse[], string>({
      query: (roomId) => ({
        url: `/rooms/${roomId}/members`,
        method: "GET",
      }),
      providesTags: (result, error, roomId) => [{ type: "Room", id: roomId }],
    }),

    getActiveMeeting: builder.query<
      ActiveMeetingResponse,
      { roomId: string; channelId: string }
    >({
      query: ({ roomId, channelId }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/active`,
        method: "GET",
      }),
    }),

    joinMeeting: builder.mutation<
      MeetingJoinResponse,
      {
        roomId: string;
        channelId: string;
        displayName?: string;
        forceSwitch?: boolean;
      }
    >({
      query: ({ roomId, channelId, displayName, forceSwitch }) => ({
        url: `/rooms/${roomId}/channels/${channelId}/meetings/join`,
        method: "POST",
        data: { displayName, forceSwitch },
      }),
    }),
  }),

  overrideExisting: false,
});

export const {
  useGetActiveMeetingQuery,
  useJoinMeetingMutation,
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
