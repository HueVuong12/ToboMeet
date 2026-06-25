import axios from "axios";
import Constants from "expo-constants";

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:3001/api`;
  }
  
  return "http://localhost:3001/api";
};

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data.code === "number") {
      if (response.data.code >= 200 && response.data.code < 300) {
        return response.data.result;
      }
      return Promise.reject(response.data);
    }
    return response.data;
  },
  (error) => {
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject({
      code: 5000,
      message: error.message || "Lỗi kết nối đến máy chủ",
    });
  }
);
