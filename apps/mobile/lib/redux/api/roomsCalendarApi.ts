import { baseApi } from "./baseApi";

export const roomsCalendarApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyRoomsForCalendar: builder.query<any[], void>({
      query: () => ({
        url: "/rooms/my",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetMyRoomsForCalendarQuery } = roomsCalendarApi;
