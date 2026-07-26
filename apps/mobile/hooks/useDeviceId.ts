// hooks/useDeviceId.ts (Dành cho Mobile)
import { useState, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrCreateDeviceId = async () => {
      const DEVICE_KEY = "tobo_mobile_device_id";

      try {
        let storedId = await AsyncStorage.getItem(DEVICE_KEY);

        if (!storedId) {
          // Lấy ID định danh phần cứng từ OS nếu có thể
          if (Platform.OS === "android") {
            storedId = Application.getAndroidId();
          } else if (Platform.OS === "ios") {
            storedId = await Application.getIosIdForVendorAsync();
          }

          // Fallback nếu không lấy được hardware ID
          if (!storedId) {
            storedId = `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          }

          await AsyncStorage.setItem(DEVICE_KEY, storedId);
        }

        setDeviceId(storedId);
      } catch (error) {
        console.error("Lỗi khi khởi tạo Device ID:", error);
        // Fallback khẩn cấp nếu AsyncStorage bị crash
        setDeviceId(`temp_${Date.now()}`);
      }
    };

    fetchOrCreateDeviceId();
  }, []);

  return deviceId;
}
