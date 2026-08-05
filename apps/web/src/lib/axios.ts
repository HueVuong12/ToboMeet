import { ApiResponse } from "@tobomeet/shared/types";
import axios, { AxiosError } from "axios";
import { createClient } from "@/lib/supabase/client";

export const axiosInstance = axios.create({
  baseURL: "/api",
});

let isLoggingOut = false;

export async function doClientLogout() {
  if (isLoggingOut) return;
  isLoggingOut = true;

  try {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {}

  if (typeof window !== "undefined") {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    const locale = window.location.pathname.split("/")[1] || "vi";
    window.location.href = `/api/auth/logout?locale=${locale}`;
  }
}

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
    const response = error.response?.data as ApiResponse<unknown>;

    // Nếu tài khoản bị khóa hoặc phiên bị thu hồi từ xa (401 / 403)
    if (
      (error.response?.status === 401 ||
        (error.response?.status === 403 && response?.code === 4031)) &&
      !isLoggingOut
    ) {
      doClientLogout();
      return new Promise(() => {});
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
