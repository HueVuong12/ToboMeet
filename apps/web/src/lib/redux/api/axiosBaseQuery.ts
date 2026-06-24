import { axiosInstance } from "@/lib/axios";
import { ApiResponse } from "@tobomeet/shared/types";

interface AxiosBaseQueryArgs {
  url: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

// Adapter chuyển đổi Axios -> RTK Query
export const axiosBaseQuery =
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

      return { data: result };
    } catch (axiosError: unknown) {
      const err = axiosError as ApiResponse<null>;

      return {
        error: err,
      };
    }
  };
