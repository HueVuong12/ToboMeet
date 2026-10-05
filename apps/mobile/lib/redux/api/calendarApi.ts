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
    deleteCalendarEvent: builder.mutation<
      void,
      string | { id: string; type?: "single" | "all"; occurrenceDate?: string }
    >({
      query: (arg) => {
        if (typeof arg === "string") {
          return {
            url: `/calendar/${arg}?type=all`,
            method: "DELETE",
          };
        }
        const { id, type = "all", occurrenceDate } = arg;
        const queryParams = new URLSearchParams({ type });
        if (occurrenceDate) queryParams.append("occurrenceDate", occurrenceDate);
        return {
          url: `/calendar/${id}?${queryParams.toString()}`,
          method: "DELETE",
        };
      },
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
    updateCalendarRsvp: builder.mutation<
      { success: boolean; status: "ACCEPTED" | "DECLINED" | "TENTATIVE" },
      { eventId: string; status: "ACCEPTED" | "DECLINED" | "TENTATIVE" }
    >({
      query: ({ eventId, status }) => ({
        url: `/calendar/${eventId}/rsvp`,
        method: "PATCH",
        data: { status },
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp", "Notification"],
    }),
    searchCalendarEvents: builder.query<any[], string>({
      query: (query) => ({
        url: `/calendar/search?q=${encodeURIComponent(query.trim())}`,
        method: "GET",
      }),
      providesTags: ["CalendarEvent"],
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
  useUpdateCalendarRsvpMutation,
  useSearchCalendarEventsQuery,
  useLazySearchCalendarEventsQuery,
} = calendarApi;

