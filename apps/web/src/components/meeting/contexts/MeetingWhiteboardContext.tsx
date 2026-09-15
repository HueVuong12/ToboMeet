"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useGetWhiteboardTokenMutation } from "@/lib/redux/api/meetingsApi";
import { toast } from "sonner";

interface MeetingWhiteboardContextType {
  isWhiteboardActive: boolean;
  whiteboardToken: string | null;
  whiteboardUrl: string | null;
  isLoadingToken: boolean;
  whiteboardError: string | null;
  joinWhiteboard: () => Promise<void>;
  leaveWhiteboard: () => void;
  toggleWhiteboard: () => Promise<void>;
}

const MeetingWhiteboardContext = createContext<MeetingWhiteboardContextType | null>(null);

export function MeetingWhiteboardProvider({
  meetingCode,
  children,
}: {
  meetingCode: string;
  children: ReactNode;
}) {
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [whiteboardToken, setWhiteboardToken] = useState<string | null>(null);
  const [whiteboardUrl, setWhiteboardUrl] = useState<string | null>(null);
  const [whiteboardError, setWhiteboardError] = useState<string | null>(null);

  const [getTokenApi, { isLoading: isLoadingToken }] = useGetWhiteboardTokenMutation();

  const joinWhiteboard = useCallback(async () => {
    if (!meetingCode) return;

    try {
      setWhiteboardError(null);

      // Nếu đã có token hợp lệ rồi thì chỉ cần bật hiển thị
      if (whiteboardToken && whiteboardUrl) {
        setIsWhiteboardActive(true);
        return;
      }

      toast.info("Đang xin token bảo mật để vào Whiteboard...");
      const res = await getTokenApi({ meetingCode }).unwrap();

      setWhiteboardToken(res.token);
      setWhiteboardUrl(res.whiteboardUrl || process.env.NEXT_PUBLIC_WHITEBOARD_URL || "ws://localhost:3002/sync");
      setIsWhiteboardActive(true);
      toast.success("Đã tham gia Whiteboard!");
    } catch (err: any) {
      console.error("Lỗi xin whiteboard token:", err);
      const msg = err?.data?.message || err?.message || "Không thể tham gia Whiteboard";
      setWhiteboardError(msg);
      toast.error(msg);
    }
  }, [meetingCode, whiteboardToken, whiteboardUrl, getTokenApi]);

  const leaveWhiteboard = useCallback(() => {
    setIsWhiteboardActive(false);
  }, []);

  const toggleWhiteboard = useCallback(async () => {
    if (isWhiteboardActive) {
      leaveWhiteboard();
    } else {
      await joinWhiteboard();
    }
  }, [isWhiteboardActive, leaveWhiteboard, joinWhiteboard]);

  return (
    <MeetingWhiteboardContext.Provider
      value={{
        isWhiteboardActive,
        whiteboardToken,
        whiteboardUrl,
        isLoadingToken,
        whiteboardError,
        joinWhiteboard,
        leaveWhiteboard,
        toggleWhiteboard,
      }}
    >
      {children}
    </MeetingWhiteboardContext.Provider>
  );
}

export function useMeetingWhiteboard() {
  const context = useContext(MeetingWhiteboardContext);
  if (!context) {
    throw new Error("useMeetingWhiteboard phải được đặt trong MeetingWhiteboardProvider");
  }
  return context;
}

export function useSafeMeetingWhiteboard() {
  return useContext(MeetingWhiteboardContext);
}

