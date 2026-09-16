"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

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
  const [whiteboardUrl] = useState<string | null>(
    process.env.NEXT_PUBLIC_WHITEBOARD_URL || "ws://localhost:3002/sync"
  );
  const [whiteboardError, setWhiteboardError] = useState<string | null>(null);

  const joinWhiteboard = useCallback(async () => {
    if (!meetingCode) return;
    setWhiteboardError(null);
    setIsWhiteboardActive(true);
  }, [meetingCode]);

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
        whiteboardToken: null,
        whiteboardUrl,
        isLoadingToken: false,
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

