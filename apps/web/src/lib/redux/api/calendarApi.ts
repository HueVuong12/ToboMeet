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

    deleteCalendarEvent: builder.mutation<void, string>({
      query: (id) => ({
        url: `/calendar/${id}?type=all`,
        method: "DELETE",
      }),
      invalidatesTags: ["CalendarEvent", "CalendarRsvp"],
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
} = calendarApi;
