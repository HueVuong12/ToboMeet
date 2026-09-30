import { baseApi } from "./baseApi";

export const calendarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCalendarEvents: builder.query<any[], { start: string; end: string }>({
      query: ({ start, end }) => ({
        url: `/calendar?start=${start}&end=${end}`,
        method: "GET",
      }),
      providesTags: ["CalendarEvent"],
    }),
    getCalendarRsvp: builder.query<any[], string>({
      query: (eventId) => ({
        url: `/calendar/${eventId}/rsvp`,
        method: "GET",
      }),
      providesTags: (result, error, eventId) => [{ type: "CalendarRsvp", id: eventId }],
    }),
    createCalendarEvent: builder.mutation<any, any>({
      query: (body) => ({
        url: "/calendar",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["CalendarEvent"],
    }),
    updateCalendarEvent: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/calendar/${id}?type=all`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp"],
    }),
    deleteCalendarEvent: builder.mutation<any, string>({
      query: (id) => ({
        url: `/calendar/${id}?type=all`,
        method: "DELETE",
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp"],
    }),
    inviteCalendarMembers: builder.mutation<
      { success: boolean; count: number; event: any },
      { id: string; userIds?: string[]; invitees?: any[] }
    >({
      query: ({ id, userIds, invitees }) => ({
        url: `/calendar/${id}/invite`,
        method: "POST",
        data: { userIds, invitees },
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp"],
    }),
    leaveCalendarEvent: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/calendar/${id}/leave`,
        method: "POST",
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp", "Notification"],
    }),
  }),
});

export const {
  useGetCalendarEventsQuery,
  useLazyGetCalendarEventsQuery,
  useGetCalendarRsvpQuery,
  useLazyGetCalendarRsvpQuery,
  useCreateCalendarEventMutation,
  useUpdateCalendarEventMutation,
  useDeleteCalendarEventMutation,
  useInviteCalendarMembersMutation,
  useLeaveCalendarEventMutation,
} = calendarApi;

