import { ApiResponse } from "@tobomeet/shared/types";
import axios, { AxiosError } from "axios";

export const axiosInstance = axios.create({
  baseURL: "/api",
});

axiosInstance.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse<unknown>;

    if (data && typeof data.code === "number") {
      if (data.code >= 200 && data.code < 300) {
        return data.result;
      }

      return Promise.reject(data);
    }

    return response.data;
  },
  (error: AxiosError) => {
    if (error.response?.status === 403) {
      const data = error.response.data as any;
      if (
        data?.message?.includes("bị khóa") ||
        data?.message?.includes("locked") ||
        (typeof data?.message === "string" && data.message.includes("khóa"))
      ) {
        if (typeof window !== "undefined") {
          window.location.href = `/${document.documentElement.lang || "vi"}/login?error=error.auth.user_locked`;
        }
      }
    }

    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }

    // Lỗi mạng hoặc server sập hẳn
    return Promise.reject({
      code: 5000,
      message: error.message || "Lỗi kết nối đến máy chủ",
      result: null,
    });
  },
);
