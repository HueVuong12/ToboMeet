"use client";

import { useEffect } from "react";
import { useUpdateCurrentSessionLocationMutation } from "@/lib/redux/api/usersApi";
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

  // Lắng nghe sự kiện thu hồi phiên từ xa qua Socket.io
  useEffect(() => {
    const handleSessionRevoked = async (data?: { sessionId?: string; revokedSessionIds?: string[] }) => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) return;

        const currentSid = await extractClientSessionId(token);

        const isRevokedSingle = Boolean(
          data?.sessionId &&
            (data.sessionId === currentSid || data.sessionId === session?.user?.id),
        );
        const isRevokedList = Boolean(
          Array.isArray(data?.revokedSessionIds) &&
            (data.revokedSessionIds.includes(currentSid) ||
              data.revokedSessionIds.includes(session?.user?.id || "")),
        );

        if (isRevokedSingle || isRevokedList) {
          await doClientLogout();
          return;
        }

        // 🟢 Kiểm tra 2 Lớp (Double Check 401): Gửi request nhẹ tới Backend để xác minh phiên
        try {
          const res = await fetch("/api/users/me/sessions", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.status === 401) {
            await doClientLogout();
          }
        } catch {}
      } catch {}
    };

    socket.on("session_revoked", handleSessionRevoked);
    return () => {
      socket.off("session_revoked", handleSessionRevoked);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    let isMounted = true;
    const timeoutId = setTimeout(() => {}, 5000);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timeoutId);
        if (!isMounted) return;
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi`,
            { headers: { "User-Agent": "ToBoMeet-Web" } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.state || addr.province || "";
            const country = addr.country || "";
            if (city && country) {
              updateLocation({ city, country }).unwrap().catch(() => {});
            } else if (country) {
              updateLocation({ city: "", country }).unwrap().catch(() => {});
            }
          }
        } catch {}
      },
      () => {
        clearTimeout(timeoutId);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [updateLocation]);

  return null;
}
