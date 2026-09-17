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
import { useMeetingWhiteboard } from "@/components/meeting/contexts/MeetingWhiteboardContext";
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
  } catch {
    // Bỏ qua lỗi nếu quota bị đầy hoặc private mode
  }
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
}

export function useMeetingWhiteboardLogic({
  meetingCode,
  whiteboardUrl,
}: UseMeetingWhiteboardLogicOptions) {
  const t = useTranslations("meeting.whiteboard");
  const { leaveWhiteboard } = useMeetingWhiteboard();
  const [getTokenMutation] = useGetWhiteboardTokenMutation();

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

    if (res.user) {
      const finalName = storedName || res.user.name || "";
      const updatedUser = { ...res.user, name: finalName };
      setWhiteboardUser(updatedUser);
    } else {
      const parsed = parseJwtPayload(res.token);
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

  const uri = useCallback(async () => {
    const token = await getWhiteboardToken();
    const rawUrl =
      process.env.NEXT_PUBLIC_WHITEBOARD_URL ||
      whiteboardUrlRef.current ||
      "ws://localhost:3002/sync";
    const baseUrl = rawUrl.replace(/\/$/, "");

    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }, [getWhiteboardToken]);

  const store = useSync({
    uri,
    assets: defaultAssetStore,
    users: userStore,
  });

  // Cơ chế Reactive khi gặp lỗi: Nếu kết nối thất bại, hủy bỏ token trong cache để lần kết nối kế tiếp xin token mới
  useEffect(() => {
    if (store.status === "error") {
      invalidateWhiteboardToken(meetingCode);
    }
  }, [store.status, meetingCode]);

  const handleRetry = useCallback(() => {
    invalidateWhiteboardToken(meetingCode);
    window.location.reload();
  }, [meetingCode]);

  return {
    store,
    user,
    whiteboardUser,
    userPreferences,
    updateUserPreferences,
    leaveWhiteboard,
    handleRetry,
    t,
  };
}
