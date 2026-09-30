import { baseApi } from "./baseApi";
import { CalendarEvent } from "@/components/calendar/types";

export const calendarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCalendarEvents: builder.query<CalendarEvent[], { start: string; end: string }>({
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

    searchCalendarEvents: builder.query<CalendarEvent[], string>({
      query: (q) => ({
        url: `/calendar/search?q=${encodeURIComponent(q)}`,
        method: "GET",
      }),
      providesTags: ["CalendarEvent"],
    }),

    createCalendarEvent: builder.mutation<CalendarEvent, any>({
      query: (body) => ({
        url: "/calendar",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["CalendarEvent"],
    }),

    updateCalendarEvent: builder.mutation<CalendarEvent, { id: string; body: any }>({
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

    restoreCalendarOccurrence: builder.mutation<
      { success: boolean; recurrenceExceptions: string[] },
      { id: string; occurrenceDate: string }
    >({
      query: ({ id, occurrenceDate }) => ({
        url: `/calendar/${id}/restore`,
        method: "POST",
        data: { occurrenceDate },
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp"],
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
      invalidatesTags: ["CalendarEvent", "CalendarRsvp"],
    }),

    inviteCalendarMembers: builder.mutation<
      { success: boolean; count: number; event: CalendarEvent },
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
  overrideExisting: true,
});

export const {
  useGetCalendarEventsQuery,
  useLazyGetCalendarEventsQuery,
  useGetCalendarRsvpQuery,
  useLazyGetCalendarRsvpQuery,
  useSearchCalendarEventsQuery,
  useLazySearchCalendarEventsQuery,
  useCreateCalendarEventMutation,
  useUpdateCalendarEventMutation,
  useDeleteCalendarEventMutation,
  useRestoreCalendarOccurrenceMutation,
  useUpdateCalendarRsvpMutation,
  useInviteCalendarMembersMutation,
  useLeaveCalendarEventMutation,
} = calendarApi;


