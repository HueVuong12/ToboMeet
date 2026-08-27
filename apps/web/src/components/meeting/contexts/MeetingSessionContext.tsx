// src/components/meeting/contexts/MeetingSessionContext.tsx
import { useMeetingSession } from "@/hooks/useMeetingSession";
import { createContext, useContext, ReactNode } from "react";

type MeetingSessionType = ReturnType<typeof useMeetingSession>;

const MeetingSessionContext = createContext<MeetingSessionType | null>(null);

export function MeetingSessionProvider({ children }: { children: ReactNode }) {
  const sessionData = useMeetingSession();

  return (
    <MeetingSessionContext.Provider value={sessionData}>
      {children}
    </MeetingSessionContext.Provider>
  );
}

export function useMeetingSessionContext() {
  const context = useContext(MeetingSessionContext);
  if (!context) {
    throw new Error(
      "useMeetingSessionContext phải được đặt trong MeetingSessionProvider",
    );
  }
  return context;
}
