import { baseApi } from "./baseApi";

export const calendarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCalendarEvents: builder.query<any[], { start: string; end: string }>({
      query: ({ start, end }) => ({
        url: `/calendar?start=${start}&end=${end}`,
        method: "GET",
      }),
    }),
    createCalendarEvent: builder.mutation<any, any>({
      query: (body) => ({
        url: "/calendar",
        method: "POST",
        data: body,
      }),
    }),
    updateCalendarEvent: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/calendar/${id}?type=all`,
        method: "PUT",
        data: body,
      }),
    }),
    deleteCalendarEvent: builder.mutation<any, string>({
      query: (id) => ({
        url: `/calendar/${id}?type=all`,
        method: "DELETE",
      }),
    }),
    searchUsers: builder.query<any[], string>({
      query: (query) => ({
        url: `/users/search?q=${encodeURIComponent(query)}`,
        method: "GET",
      }),
      transformResponse: (response: any) => {
        return response && Array.isArray(response.result) ? response.result : [];
      },
    }),
  }),
});

export const {
  useGetCalendarEventsQuery,
  useCreateCalendarEventMutation,
  useUpdateCalendarEventMutation,
  useDeleteCalendarEventMutation,
  useLazySearchUsersQuery,
} = calendarApi;

