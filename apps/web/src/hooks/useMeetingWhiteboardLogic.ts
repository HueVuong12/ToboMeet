"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSync } from "@tldraw/sync";
import {
  TLAssetStore,
  computed,
  createUserId,
  UserRecordType,
  TLUserStore,
  TLUserPreferences,
  useTldrawCurrentUser,
  atom,
} from "tldraw";
import { useTranslations } from "next-intl";
import { useSafeMeetingWhiteboard } from "@/components/meeting/contexts/MeetingWhiteboardContext";
import { useGetWhiteboardTokenMutation } from "@/lib/redux/api/meetingsApi";
import {
  getOrRefreshWhiteboardToken,
  invalidateWhiteboardToken,
  getCachedWhiteboardUser,
  parseJwtPayload,
  WhiteboardUserInfo,
} from "@/lib/whiteboard/whiteboardTokenManager";

export const WHITEBOARD_DISPLAY_NAME_STORAGE_KEY = "tobomeet_whiteboard_display_name";

/**
 * Đọc tên hiển thị đã lưu trong LocalStorage (nếu có)
 */
export const getStoredWhiteboardDisplayName = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(WHITEBOARD_DISPLAY_NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * Lưu tên hiển thị vào LocalStorage
 */
export const setStoredWhiteboardDisplayName = (name: string): void => {
  if (typeof window === "undefined" || !name?.trim()) return;
  try {
    localStorage.setItem(WHITEBOARD_DISPLAY_NAME_STORAGE_KEY, name.trim());
  } catch { }
};

const defaultAssetStore: TLAssetStore = {
  upload: async (_asset, file) => {
    return {
      src: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
    };
  },
  resolve: (asset) => asset.props.src,
};

export interface UseMeetingWhiteboardLogicOptions {
  meetingCode: string;
  whiteboardUrl?: string | null;
  onClose?: () => void;
  onRetry?: () => void;
}

export function useMeetingWhiteboardLogic({
  meetingCode,
  whiteboardUrl,
  onClose,
  onRetry,
}: UseMeetingWhiteboardLogicOptions) {
  const t = useTranslations("meeting.whiteboard");
  const safeContext = useSafeMeetingWhiteboard();
  const [getTokenMutation] = useGetWhiteboardTokenMutation();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSessionTransferred, setIsSessionTransferred] = useState(false);

  const leaveWhiteboard = useCallback(() => {
    if (onClose) {
      onClose();
    } else if (safeContext?.leaveWhiteboard) {
      safeContext.leaveWhiteboard();
    } else if (typeof window !== "undefined") {
      window.close();
    }
  }, [onClose, safeContext]);

  const [whiteboardUser, setWhiteboardUser] = useState<WhiteboardUserInfo | null>(() => {
    const storedName = getStoredWhiteboardDisplayName();
    const cached = getCachedWhiteboardUser(meetingCode);
    if (storedName) {
      return { id: cached?.id || "", name: storedName };
    }
    return cached || null;
  });

  const [userPreferences, setUserPreferences] = useState<TLUserPreferences>(() => {
    const storedName = getStoredWhiteboardDisplayName();
    const cachedUser = getCachedWhiteboardUser(meetingCode);
    return {
      id: cachedUser?.id || "",
      name: storedName || cachedUser?.name || "",
      color: "#3b82f6",
    };
  });

  const userPreferencesAtom = useMemo(
    () => atom<TLUserPreferences>("whiteboard-user-preferences", userPreferences),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const updateUserPreferences = useCallback(
    (nextOrUpdater: React.SetStateAction<TLUserPreferences>) => {
      setUserPreferences((previous) => {
        const next =
          typeof nextOrUpdater === "function" ? nextOrUpdater(previous) : nextOrUpdater;

        userPreferencesAtom.set(next);

        // CHỈ lưu vào LocalStorage khi người dùng chủ động đổi tên (tên mới khác tên cũ)
        if (next.name && next.name !== previous.name) {
          setStoredWhiteboardDisplayName(next.name);
        }

        return next;
      });
    },
    [userPreferencesAtom]
  );

  // Khôi phục tên từ localStorage nếu có (ưu tiên hàng đầu)
  useEffect(() => {
    const storedName = getStoredWhiteboardDisplayName();
    if (storedName) {
      updateUserPreferences((prev) => {
        if (prev.name === storedName) return prev;
        return { ...prev, name: storedName };
      });
    }
  }, [updateUserPreferences]);

  // Cập nhật userPreferences khi whiteboardUser thay đổi (ưu tiên tên đã có trong localStorage/state)
  useEffect(() => {
    if (!whiteboardUser) return;

    const storedName = getStoredWhiteboardDisplayName();
    const finalName = storedName || whiteboardUser.name || "";

    updateUserPreferences((prev) => ({
      ...prev,
      id: whiteboardUser.id || prev.id,
      name: prev.name || finalName,
    }));
  }, [whiteboardUser, updateUserPreferences]);

  const user = useTldrawCurrentUser({
    userPreferences,
    setUserPreferences: updateUserPreferences,
  });

  const currentUser = useMemo(() => {
    return computed("currentUser", () => {
      const preferences = userPreferencesAtom.get();

      if (!preferences.id) {
        return null;
      }

      return UserRecordType.create({
        id: createUserId(preferences.id),
        name: preferences.name ?? undefined,
        color: preferences.color ?? undefined,
      });
    });
  }, [userPreferencesAtom]);

  const userStore = useMemo<TLUserStore | undefined>(() => {
    if (!currentUser) return undefined;
    return {
      currentUser,
    };
  }, [currentUser]);

  const getTokenMutationRef = useRef(getTokenMutation);
  getTokenMutationRef.current = getTokenMutation;

  const meetingCodeRef = useRef(meetingCode);
  meetingCodeRef.current = meetingCode;

  const whiteboardUrlRef = useRef(whiteboardUrl);
  whiteboardUrlRef.current = whiteboardUrl;

  const rawFetchToken = useCallback(async (): Promise<string> => {
    const res = await getTokenMutationRef.current({
      meetingCode: meetingCodeRef.current,
    }).unwrap();

    if (!res?.token) {
      throw new Error(t("fetch_token_error"));
    }

    const storedName = getStoredWhiteboardDisplayName();
    const parsed = parseJwtPayload(res.token);
    if (parsed) {
      setIsReadOnly(Boolean(parsed.isReadOnly ?? parsed.isReadonly ?? false));
    }

    if (res.user) {
      const finalName = storedName || res.user.name || "";
      const updatedUser = { ...res.user, name: finalName };
      setWhiteboardUser(updatedUser);
    } else {
      if (parsed?.sub) {
        const finalName = storedName || parsed.displayName || "";
        setWhiteboardUser({ id: parsed.sub, name: finalName });
      }
    }

    return res.token;
  }, [t]);

  const getWhiteboardToken = useCallback(
    async (forceRefresh = false): Promise<string> => {
      const token = await getOrRefreshWhiteboardToken(
        meetingCodeRef.current,
        rawFetchToken,
        forceRefresh
      );

      if (!whiteboardUser) {
        const cachedUser = getCachedWhiteboardUser(meetingCodeRef.current);
        if (cachedUser) {
          const storedName = getStoredWhiteboardDisplayName();
          const finalName = storedName || cachedUser.name || "";
          setWhiteboardUser({ ...cachedUser, name: finalName });
        }
      }

      return token;
    },
    [rawFetchToken, whiteboardUser]
  );

  // Ref để chặn useSync auto-reconnect sau khi bị kick (SESSION_TRANSFERRED).
  // Dùng ref thay vì state để tránh re-render và đảm bảo giá trị mới nhất trong closure.
  const isTransferredRef = useRef(false);

  const uri = useCallback(async () => {
    // Nếu đã bị chuyển session, trả về chuỗi rỗng để useSync không reconnect
    if (isTransferredRef.current) {
      return "";
    }
    const token = await getWhiteboardToken();
    const rawUrl =
      process.env.NEXT_PUBLIC_WHITEBOARD_URL ||
      whiteboardUrlRef.current ||
      "ws://localhost:3002/sync";
    const baseUrl = rawUrl.replace(/\/$/, "");

    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }, [getWhiteboardToken]);

  const onCustomMessageReceived = useCallback((data: any) => {
    if (data?.type === "SESSION_TRANSFERRED" || data?.reason === "SESSION_TRANSFERRED") {
      isTransferredRef.current = true;
      setIsSessionTransferred(true);
    }
  }, []);

  const store = useSync({
    uri,
    assets: defaultAssetStore,
    users: userStore,
    onCustomMessageReceived,
  });

  // Cơ chế Reactive khi gặp lỗi: Nếu kết nối thất bại, hủy bỏ token trong cache để lần kết nối kế tiếp xin token mới.
  // Ngoại lệ: SESSION_TRANSFERRED — không invalidate token vì isTransferredRef đã chặn reconnect rồi,
  // invalidate thêm sẽ gây vòng lặp (invalidate → uri() fetch token mới → reconnect → bị kick lại).
  useEffect(() => {
    if (
      store.status === "error" &&
      !store.error?.message?.includes("SESSION_TRANSFERRED")
    ) {
      invalidateWhiteboardToken(meetingCode);
    }
  }, [store.status, store.error, meetingCode]);

  const isTransferred =
    isSessionTransferred ||
    (store.status === "error" &&
      (store.error?.message === "SESSION_TRANSFERRED" ||
        store.error?.message?.includes("SESSION_TRANSFERRED")));

  const handleRetry = useCallback(() => {
    // Reset ref trước để uri() được phép gọi lại khi useSync reconnect
    isTransferredRef.current = false;
    setIsSessionTransferred(false);
    invalidateWhiteboardToken(meetingCode);
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  }, [meetingCode, onRetry]);

  return {
    store,
    user,
    whiteboardUser,
    isReadOnly,
    isTransferred,
    userPreferences,
    updateUserPreferences,
    leaveWhiteboard,
    handleRetry,
    t,
  };
}
