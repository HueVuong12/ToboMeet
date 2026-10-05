import { useEffect } from "react";
import { socket } from "../../lib/socket";
import { useCalendarCacheManager } from "../useCalendarCacheManager";
import { CalendarEvent } from "../../components/calendar/types";

export function useCalendarSocketEvents(options?: {
  onEventCreated?: (event: CalendarEvent) => void;
  onEventUpdated?: (data: any) => void;
  onEventDeleted?: (data: any) => void;
}) {
  const { addEventToCache, updateEventInCache, deleteEventFromCache } =
    useCalendarCacheManager();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const handleCreated = (event: CalendarEvent) => {
      addEventToCache(event);
      options?.onEventCreated?.(event);
    };

    const handleUpdated = (data: {
      eventId: string;
      updateType?: "single" | "all" | "restore";
      occurrenceDate?: string;
      event?: CalendarEvent;
    }) => {
      updateEventInCache(data);
      options?.onEventUpdated?.(data);
    };

    const handleDeleted = (data: {
      eventId: string;
      deleteType?: "single" | "all";
      occurrenceDate?: string;
    }) => {
      deleteEventFromCache(data);
      options?.onEventDeleted?.(data);
    };

    socket.on("calendar_event_created", handleCreated);
    socket.on("channel_calendar_event_created", handleCreated);
    socket.on("calendar_event_updated", handleUpdated);
    socket.on("calendar_event_deleted", handleDeleted);

    return () => {
      socket.off("calendar_event_created", handleCreated);
      socket.off("channel_calendar_event_created", handleCreated);
      socket.off("calendar_event_updated", handleUpdated);
      socket.off("calendar_event_deleted", handleDeleted);
    };
  }, [addEventToCache, updateEventInCache, deleteEventFromCache, options]);

  return {
    addEventToCache,
    updateEventInCache,
    deleteEventFromCache,
  };
}
