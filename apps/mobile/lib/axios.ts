import { ApiResponse } from "@tobomeet/shared/types";
import axios, { AxiosError } from "axios";
import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.169:3001/api";
console.log("[axios] API baseURL:", API_BASE_URL);

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession(); // Tự động refresh nếu cần
      const token = session?.access_token;

      // Tự động đính kèm Token
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Lỗi khi lấy token:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Lọc và bóc tách dữ liệu
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
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }

    // Xử lý lỗi mạng / Timeout
    return Promise.reject({
      code: 5000,
      message: error.message || "Lỗi kết nối đến máy chủ",
      result: null,
    });
  },
);
