import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./axiosBaseQuery";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    "User",
    "Room",
    "UserSessions",
    "Report",
    "Post",
    "Comment",
    "DeviceStatus",
    "ChannelFile",
    "Notification",
    "UserSearch",
  ],
  endpoints: () => ({}),
});
