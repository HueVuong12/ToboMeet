import { ApiResponse } from "@tobomeet/shared/types";
import axios, { AxiosError } from "axios";
import { Platform } from "react-native";
import { supabase } from "./supabase";

let Device: any = null;
try {
  Device = require("expo-device");
} catch (err) {
  console.warn("Failed to load expo-device native module:", err);
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://dolphin-paternity-estrogen.ngrok-free.dev/api";
console.log("[axios] API baseURL:", API_BASE_URL);

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Single Refresh Lock & Cooldown 30s ngăn lặp log khi gia hạn thất bại
let refreshPromise: Promise<string | null> | null = null;
let lastFailedRefreshTime = 0;

const getFreshAccessToken = async (): Promise<string | null> => {
  const now = Date.now();
  // Nếu vừa gia hạn thất bại trong vòng 30 giây -> Không thử lại liên tục để tránh lặp log
  if (now - lastFailedRefreshTime < 30000) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshData?.session?.access_token) {
          console.log("[axios] Gia hạn Token thành công!");
          lastFailedRefreshTime = 0;
          return refreshData.session.access_token;
        } else {
          lastFailedRefreshTime = Date.now();
        }
      } catch (err) {
        lastFailedRefreshTime = Date.now();
        console.error("Lỗi khi gia hạn token:", err);
      } finally {
        refreshPromise = null;
      }
      return null;
    })();
  }
  return refreshPromise;
};

// Interceptor Yêu cầu: Tự động đính kèm & Gia hạn Token trước khi hết hạn (Proactive Refresh)
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();

      // Kiểm tra nếu token hết hạn hoặc sắp hết hạn trong vòng 60 giây -> Chủ động Refresh
      if (session?.expires_at) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        if (session.expires_at - nowInSeconds < 60) {
          const newToken = await getFreshAccessToken();
          if (newToken) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${newToken}`;
            return config;
          }
        }
      }

      const token = session?.access_token;

      // Tự động đính kèm Token & thông tin thiết bị
      if (config.headers) {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        const defaultOS = Platform.OS === "ios" ? "iOS" : "Android";
        const defaultBrand = Platform.OS === "ios" ? "Apple" : "";
        const defaultModel = Platform.OS === "ios" ? "iPhone" : "Android Device";
        const defaultName = Platform.OS === "ios" ? "iPhone" : "Android";

        config.headers["x-device-name"] = Device?.deviceName || defaultName;
        config.headers["x-device-model"] = Device?.modelName || defaultModel;
        config.headers["x-device-brand"] = Device?.brand || defaultBrand;
        config.headers["x-device-os"] = Device?.osName || defaultOS;
        
        // Bypass ngrok warning page
        config.headers["ngrok-skip-browser-warning"] = "true";
      }
    } catch (error) {
      console.error("Lỗi khi lấy/gia hạn token:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Interceptor Phản hồi: Tự động xin Token mới & Gửi lại yêu cầu nếu gặp lỗi Token (Reactive Refresh & Retry)
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
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    const responseData = error.response?.data as any;

    // Kiểm tra nếu lỗi do Token hết hạn/không hợp lệ (mã 1003 hoặc status 401)
    const isTokenError =
      error.response?.status === 401 ||
      responseData?.code === 1003 ||
      (typeof responseData?.message === "string" && responseData.message.includes("Token"));

    if (isTokenError) {
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        const newToken = await getFreshAccessToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          console.log("[axios] Đã cập nhật Token mới! Gửi lại yêu cầu...");
          return axiosInstance(originalRequest);
        }
      }

      // Nếu không có token mới hoặc đã thử lại nhưng vẫn lỗi -> Phiên đăng nhập hết hạn hoàn toàn
      console.log("[axios] Phiên đăng nhập hết hạn hoàn toàn. Tiến hành đăng xuất trên Mobile...");
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (err) {
        console.error("[axios] Lỗi khi đăng xuất trên Mobile:", err);
      }
    }

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
