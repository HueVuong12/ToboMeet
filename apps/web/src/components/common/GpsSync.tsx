"use client";

import { useEffect, useState } from "react";
import { useUpdateCurrentSessionLocationMutation, useLazyReverseGeocodeQuery } from "@/lib/redux/api/usersApi";
import { socket } from "@/lib/socket";
import { createClient } from "@/lib/supabase/client";
import { doClientLogout } from "@/lib/axios";

async function extractClientSessionId(token: string): Promise<string> {
  if (!token) return "";
  try {
    const payloadBase64 = token.split(".")[1];
    if (!payloadBase64) return "";
    const payload = JSON.parse(
      atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const sid = payload.session_id || payload.sid || payload.jti || "";
    if (sid) return sid;

    if (payload.sub) {
      const userAgent = (typeof navigator !== "undefined" ? navigator.userAgent : "").trim().toLowerCase();
      if (userAgent && typeof crypto !== "undefined" && crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(`${payload.sub}-${userAgent}`);
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      return payload.sub;
    }
    return "";
  } catch {
    return "";
  }
}

export function GpsSync() {
  const [updateLocation] = useUpdateCurrentSessionLocationMutation();
  const [triggerReverseGeocode] = useLazyReverseGeocodeQuery();

  // Track trạng thái đăng nhập để không gọi API khi chưa login
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Kiểm tra session một lần khi mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    }).catch(() => {
      setIsLoggedIn(false);
    });

    // Lắng nghe thay đổi auth state để cập nhật kịp thời
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Lắng nghe sự kiện thu hồi phiên đơn lẻ (revokeSession - logout 1 thiết bị cụ thể)
  // Lưu ý: force_logout (Đăng xuất tất cả) được xử lý bởi useForceLogoutSocket hook
  useEffect(() => {
    // Chỉ lắng nghe socket khi đã đăng nhập
    if (!isLoggedIn) return;

    const handleSessionRevoked = async (data?: { sessionId?: string }) => {
      // Chỉ xử lý khi có sessionId đơn lẻ (không phải từ LOGOUT_ALL)
      if (!data?.sessionId) return;

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) return;

        const currentSid = await extractClientSessionId(token);

        // Chỉ logout nếu sessionId bị revoke CHÍNH XÁC là session của thiết bị này
        const isCurrentSession =
          data.sessionId === currentSid ||
          data.sessionId === session?.user?.id;

        if (isCurrentSession) {
          await doClientLogout();
        }
      } catch {}
    };

    socket.on("session_revoked", handleSessionRevoked);
    return () => {
      socket.off("session_revoked", handleSessionRevoked);
    };
  }, [isLoggedIn]);

  // Lấy vị trí GPS và cập nhật lên server — CHỈ khi đã đăng nhập
  useEffect(() => {
    // Guard: không gọi API nếu chưa xác định trạng thái login hoặc chưa login
    if (isLoggedIn !== true) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let isMounted = true;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!isMounted) return;
        try {
          const { latitude, longitude } = pos.coords;
          // Gọi backend proxy thay vì Nominatim trực tiếp
          const result = await triggerReverseGeocode({ lat: latitude, lon: longitude }).unwrap();
          if (!isMounted) return;
          const { city, country } = result;
          if (city && country) {
            updateLocation({ city, country }).unwrap().catch(() => {});
          } else if (country) {
            updateLocation({ city: "", country }).unwrap().catch(() => {});
          }
        } catch {
          // Bỏ qua lỗi geocoding — không critical
        }
      },
      () => {
        // User từ chối hoặc không có GPS — bỏ qua
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, updateLocation, triggerReverseGeocode]);

  return null;
}
