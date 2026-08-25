"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import SettingsDialog from "@/components/dashboard/SettingsDialog";
import { socket } from "@/lib/socket";
import StoreProvider from "@/lib/redux/StoreProvider";
import { useGetMeQuery } from "@/lib/redux/api/usersApi";

// Modularized Calendar Components
import {
  CalendarEvent,
  CalendarViewType,
  RsvpMember,
  getCacheKey,
  formatDateTimeLocal,
} from "@/components/calendar/types";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import TimeGridView from "@/components/calendar/TimeGridView";
import MonthView from "@/components/calendar/MonthView";
import YearView from "@/components/calendar/YearView";
import CreateEventModal from "@/components/calendar/CreateEventModal";
import EventDetailModal from "@/components/calendar/EventDetailModal";
import DeleteEventConfirmModal from "@/components/calendar/DeleteEventConfirmModal";
import ChannelMeetingModal from "@/components/calendar/ChannelMeetingModal";

export default function CalendarPage() {
  return (
    <StoreProvider>
      <CalendarContent />
    </StoreProvider>
  );
}

function CalendarContent() {
  const locale = useLocale();
  const router = useRouter();
  const { data: meData } = useGetMeQuery();
  const currentUserId = meData?._id;
  const currentSupabaseId = meData?.supabaseId;

  // View & Date States
  const [view, setView] = useState<CalendarViewType>("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Caching Refs
  const eventCache = useRef<Record<string, CalendarEvent[]>>({});
  const activeFetchKeyRef = useRef<string>("");
  const calendarGridRef = useRef<HTMLDivElement>(null);

  // Modals & Popups
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [initialModalStartDate, setInitialModalStartDate] = useState<string | undefined>();
  const [initialModalEndDate, setInitialModalEndDate] = useState<string | undefined>();
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showChannelMeetingModal, setShowChannelMeetingModal] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<CalendarEvent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const searchCacheRef = useRef<Record<string, CalendarEvent[]>>({});

  // RSVP Management
  const [rsvpList, setRsvpList] = useState<RsvpMember[]>([]);
  const selectedEventRef = useRef<CalendarEvent | null>(null);

  // Fetch Events from API
  const fetchEventsForMonth = async (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
    const res = await fetch(`/api/calendar?start=${start}&end=${end}`);
    if (res.ok) {
      const data = await res.json();
      let eventList: CalendarEvent[] = [];
      if (data) {
        if (Array.isArray(data)) {
          eventList = data;
        } else if (Array.isArray(data.result)) {
          eventList = data.result;
        } else if (data.result && Array.isArray(data.result.result)) {
          eventList = data.result.result;
        }
      }
      const key = getCacheKey(date);
      eventCache.current[key] = eventList;
      return eventList;
    }
    throw new Error("Failed to fetch events");
  };

  const triggerPrefetch = (date: Date) => {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const prevKey = getCacheKey(prevMonth);
    const nextKey = getCacheKey(nextMonth);

    if (!eventCache.current[prevKey]) {
      fetchEventsForMonth(prevMonth).catch(() => {});
    }
    if (!eventCache.current[nextKey]) {
      fetchEventsForMonth(nextMonth).catch(() => {});
    }
  };

  const fetchEvents = async (forceRefetch = false) => {
    const key = getCacheKey(currentDate);
    activeFetchKeyRef.current = key;

    if (!forceRefetch && eventCache.current[key]) {
      setEvents(eventCache.current[key]);
      triggerPrefetch(currentDate);
      return;
    }

    setLoading(true);
    try {
      const eventList = await fetchEventsForMonth(currentDate);
      if (activeFetchKeyRef.current === key) {
        setEvents(eventList);
      }
      triggerPrefetch(currentDate);
    } catch (e) {
      console.error("Lỗi fetch events:", e);
    } finally {
      if (activeFetchKeyRef.current === key) {
        setLoading(false);
      }
    }
  };

  const fetchRsvpList = async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/${eventId}/rsvp`);
      if (res.ok) {
        const data = await res.json();
        let list: RsvpMember[] = [];
        if (data) {
          if (Array.isArray(data)) {
            list = data;
          } else if (Array.isArray(data.result)) {
            list = data.result;
          } else if (data.result && Array.isArray(data.result.result)) {
            list = data.result.result;
          }
        }
        setRsvpList(list);
      }
    } catch (e) {
      console.error("Lỗi fetch RSVP list:", e);
    }
  };

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
    if (selectedEvent) {
      fetchRsvpList(selectedEvent._id);
    } else {
      setRsvpList([]);
    }
  }, [selectedEvent]);

  // Realtime Calendar Search Effect
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    if (searchCacheRef.current[trimmedQuery]) {
      setSearchResults(searchCacheRef.current[trimmedQuery]);
      setSearchLoading(false);
      return;
    }

    const abortController = new AbortController();

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/calendar/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: abortController.signal },
        );
        if (res.ok) {
          const data = await res.json();
          let results: CalendarEvent[] = [];
          if (data) {
            if (Array.isArray(data.result)) {
              results = data.result;
            } else if (data.result && Array.isArray(data.result.result)) {
              results = data.result.result;
            }
          }
          searchCacheRef.current[trimmedQuery] = results;
          setSearchResults(results);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Lỗi tìm kiếm sự kiện:", err);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(delayDebounceFn);
      abortController.abort();
    };
  }, [searchQuery]);

  // Mount and Socket Effects
  useEffect(() => {
    setMounted(true);
    fetchEvents();

    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.on("calendar_event_created", () => fetchEvents(true));
      socket.on("calendar_event_updated", () => fetchEvents(true));
      socket.on("calendar_event_deleted", () => fetchEvents(true));
      socket.on("rsvp_updated", (data) => {
        if (
          selectedEventRef.current &&
          selectedEventRef.current._id === data.eventId
        ) {
          fetchRsvpList(data.eventId);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off("calendar_event_created");
        socket.off("calendar_event_updated");
        socket.off("calendar_event_deleted");
        socket.off("rsvp_updated");
      }
    };
  }, [currentDate]);

  // Điều hướng và highlight sự kiện được chọn từ Search
  const handleSelectSearchEvent = (event: CalendarEvent) => {
    setHighlightedEventId(event._id);
    setTimeout(() => {
      setHighlightedEventId(null);
    }, 4000);

    if (view === "agenda" || view === "month") {
      setView("week");
    }

    const eventDate = new Date(event.startDate);
    setCurrentDate(eventDate);
    setSearchQuery("");

    setTimeout(() => {
      if (calendarGridRef.current) {
        const startHour = eventDate.getHours() + eventDate.getMinutes() / 60;
        const topOffset = Math.max(0, (startHour - 1) * 64);
        calendarGridRef.current.scrollTo({
          top: topOffset,
          behavior: "smooth",
        });
      }
    }, 200);
  };

  const handleCellClick = (date: Date, hour: number) => {
    setEditingEvent(null);
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    setInitialModalStartDate(formatDateTimeLocal(start));
    setInitialModalEndDate(formatDateTimeLocal(end));
    setShowCreateModal(true);
  };

  const handleDropEvent = async (
    eventId: string,
    date: Date,
    hour: number,
  ) => {
    const draggedEvent = events.find((ev) => ev._id === eventId);
    if (!draggedEvent) return;

    const duration =
      new Date(draggedEvent.endDate).getTime() -
      new Date(draggedEvent.startDate).getTime();

    const newStart = new Date(date);
    newStart.setHours(hour, 0, 0, 0);
    const newEnd = new Date(newStart.getTime() + duration);

    try {
      const res = await fetch(`/api/calendar/${eventId}?type=all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        }),
      });
      if (res.ok) {
        fetchEvents(true);
      }
    } catch (err) {
      console.error("Lỗi cập nhật kéo thả:", err);
    }
  };

  const handleEditClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowDetailPopup(false);
    setShowCreateModal(true);
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    try {
      await fetch(`/api/calendar/${event._id}?type=all`, {
        method: "DELETE",
      });
      setShowDeleteConfirmModal(false);
      setShowDetailPopup(false);
      fetchEvents(true);
    } catch (err) {
      console.error("Lỗi xóa sự kiện:", err);
    }
  };

  const handleJoinMeeting = (meetingCode: string) => {
    window.location.href = `/room/join?code=${meetingCode}`;
  };

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.description &&
        ev.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === "all" || ev.roomType === typeFilter;
    return matchesSearch && matchesType;
  });

  if (!mounted) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f5f5f5] font-sans flex flex-col overflow-hidden text-slate-800">
      {/* ── Header ── */}
      <CalendarHeader
        locale={locale}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        currentDate={currentDate}
        onSetCurrentDate={setCurrentDate}
        view={view}
        onSetView={setView}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSelectSearchEvent={handleSelectSearchEvent}
        onOpenCreateEventModal={() => {
          setEditingEvent(null);
          setInitialModalStartDate(undefined);
          setInitialModalEndDate(undefined);
          setShowCreateModal(true);
        }}
        onOpenChannelMeetingModal={() => setShowChannelMeetingModal(true)}
      />

      {/* ── Main Calendar Workspace ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative bg-slate-50 p-6">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <CalendarSidebar
            locale={locale}
            currentDate={currentDate}
            onSetCurrentDate={setCurrentDate}
            events={events}
            typeFilter={typeFilter}
            onSetTypeFilter={setTypeFilter}
          />
        )}

        {/* Calendar View Area */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div
            ref={calendarGridRef}
            className="flex-1 overflow-auto px-6 relative"
          >
            {view === "agenda" ? (
              <YearView
                locale={locale}
                currentDate={currentDate}
                events={events}
                onSelectDate={(cellDate) => {
                  setCurrentDate(cellDate);
                  setView("day");
                }}
              />
            ) : view === "month" ? (
              <MonthView
                locale={locale}
                currentDate={currentDate}
                filteredEvents={filteredEvents}
                onSelectDate={(cellDate) => {
                  setCurrentDate(cellDate);
                  setView("day");
                }}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setShowDetailPopup(true);
                }}
              />
            ) : (
              <TimeGridView
                locale={locale}
                currentDate={currentDate}
                view={view}
                filteredEvents={filteredEvents}
                highlightedEventId={highlightedEventId}
                onSelectEvent={(ev) => {
                  setSelectedEvent(ev);
                  setShowDetailPopup(true);
                }}
                onCellClick={handleCellClick}
                onDropEvent={handleDropEvent}
              />
            )}
          </div>
        </main>
      </div>

      {/* ── Modals & Popups ── */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => fetchEvents(true)}
        locale={locale}
        editingEvent={editingEvent}
        initialStartDate={initialModalStartDate}
        initialEndDate={initialModalEndDate}
      />

      <ChannelMeetingModal
        isOpen={showChannelMeetingModal}
        onClose={() => setShowChannelMeetingModal(false)}
        onSuccess={() => fetchEvents(true)}
      />

      <EventDetailModal
        isOpen={showDetailPopup}
        onClose={() => setShowDetailPopup(false)}
        locale={locale}
        event={selectedEvent}
        rsvpList={rsvpList}
        currentUserId={currentUserId}
        currentSupabaseId={currentSupabaseId}
        onEdit={handleEditClick}
        onDelete={() => setShowDeleteConfirmModal(true)}
        onJoinMeeting={handleJoinMeeting}
      />

      <DeleteEventConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirm={() => {
          if (selectedEvent) {
            handleDeleteEvent(selectedEvent);
          }
        }}
        locale={locale}
      />

      {showSettingsDialog && (
        <SettingsDialog onClose={() => setShowSettingsDialog(false)} />
      )}
    </div>
  );
}
