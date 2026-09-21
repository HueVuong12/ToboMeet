/**
 * Quản lý bộ nhớ tạm (Cache), Proactive Refresh và Reactive Refresh cho Whiteboard Token.
 */

import type {
  WhiteboardJwtPayload,
  WhiteboardUserInfo,
} from "@tobomeet/shared/types";

export type { WhiteboardUserInfo, WhiteboardJwtPayload };

interface TokenCacheEntry {
  token: string;
  expiresAt: number; // Unix timestamp tính bằng giây
  user?: WhiteboardUserInfo;
}

// Bộ nhớ tạm lưu trữ token theo meetingCode
const tokenCache = new Map<string, TokenCacheEntry>();

// Map lưu trữ Promise đang chạy để chống gọi API trùng lặp khi có nhiều yêu cầu đồng thời (Concurrency Lock)
const inFlightRequests = new Map<string, Promise<string>>();

/**
 * Giải mã payload từ JWT token trên trình duyệt
 */
export function parseJwtPayload(token: string): WhiteboardJwtPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Giải mã claim "exp" từ JWT token trên trình duyệt
 */
export function parseJwtExp(token: string): number | null {
  const payload = parseJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp : null;
}

/**
 * Lấy thông tin user đã lưu trong cache hoặc giải mã từ token
 */
export function getCachedWhiteboardUser(meetingCode: string): WhiteboardUserInfo | null {
  const cached = tokenCache.get(meetingCode);
  if (cached?.user) return cached.user;
  if (cached?.token) {
    const payload = parseJwtPayload(cached.token);
    if (payload?.sub && payload?.displayName) {
      return { id: payload.sub, name: payload.displayName };
    }
  }
  return null;
}

/**
 * Cập nhật thông tin user trong cache
 */
export function setCachedWhiteboardUser(meetingCode: string, user: WhiteboardUserInfo): void {
  const cached = tokenCache.get(meetingCode);
  if (cached) {
    cached.user = user;
  }
}

/**
 * Xóa cache token của meetingCode.
 * Dùng cho Reactive Refresh khi kết nối bị lỗi hoặc token bị máy chủ từ chối.
 */
export function invalidateWhiteboardToken(meetingCode: string): void {
  tokenCache.delete(meetingCode);
}

/**
 * Lấy token từ bộ nhớ tạm nếu còn hạn
 */
export async function getOrRefreshWhiteboardToken(
  meetingCode: string,
  fetchFn: () => Promise<string>,
  forceRefresh = false
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(meetingCode);

  // Kiểm tra bộ nhớ tạm (nếu không yêu cầu ép buộc làm mới)
  if (!forceRefresh && cached) {
    const remainingSeconds = cached.expiresAt - now;

    // Token đã hết hạn từ trước (người dùng treo máy / tắt tab lâu)
    if (remainingSeconds <= 0) {
      tokenCache.delete(meetingCode);
    }
    else if (remainingSeconds > 60) {
      return cached.token;
    }
  }

  // Chống gọi API đồng thời (Deduplicate in-flight requests)
  const existingPromise = inFlightRequests.get(meetingCode);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = (async () => {
    try {
      const newToken = await fetchFn();
      const exp = parseJwtExp(newToken);
      // Mặc định 5 phút (300 giây) nếu không giải mã được exp
      const expiresAt = exp ?? Math.floor(Date.now() / 1000) + 300;

      const payload = parseJwtPayload(newToken);
      const user = payload?.sub && payload?.displayName
        ? { id: payload.sub, name: payload.displayName }
        : undefined;

      tokenCache.set(meetingCode, {
        token: newToken,
        expiresAt,
        user,
      });

      return newToken;
    } finally {
      inFlightRequests.delete(meetingCode);
    }
  })();

  inFlightRequests.set(meetingCode, requestPromise);
  return requestPromise;
}
