import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosInstance } from "../axios";
import { AxiosError } from "axios";

interface AxiosBaseQueryArgs {
  url: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// Adapter chuyển đổi Axios -> RTK Query
const axiosBaseQuery =
  ({ baseUrl } = { baseUrl: "" }) =>
  async ({ url, method, data, params, headers }: AxiosBaseQueryArgs) => {
    try {
      const result = await axiosInstance({
        url: baseUrl + url,
        method,
        data,
        params,
        headers,
      });
      return { data: result.data };
    } catch (axiosError: unknown) {
      const err = axiosError as AxiosError;

      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || err.message,
        },
      };
    }
  };

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["User"],
  endpoints: (builder) => ({
    getMe: builder.query({
      query: () => ({
        url: "/users/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),
  }),
});

export const { useGetMeQuery } = apiSlice;
