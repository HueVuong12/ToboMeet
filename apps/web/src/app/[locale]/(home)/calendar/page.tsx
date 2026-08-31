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

import {
  useGetCalendarEventsQuery,
  useLazyGetCalendarRsvpQuery,
  useSearchCalendarEventsQuery,
  useUpdateCalendarEventMutation,
  useDeleteCalendarEventMutation,
} from "@/lib/redux/api/calendarApi";

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

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
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  // RSVP Management & Mutations
  const [triggerRsvpQuery, { data: rsvpData }] = useLazyGetCalendarRsvpQuery();
  const [updateCalendarEvent] = useUpdateCalendarEventMutation();
  const [deleteCalendarEvent] = useDeleteCalendarEventMutation();

  const selectedEventRef = useRef<CalendarEvent | null>(null);

  // Calculate month boundaries for current selected date
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

  // RTK Query fetches
  const { data: rawEvents, isLoading: loading, refetch: refetchEvents } = useGetCalendarEventsQuery({
    start: startOfMonth,
    end: endOfMonth,
  });

  const events = rawEvents ?? [];

  // RSVP data mapping
  const rsvpList = rsvpData ?? [];

  // Search RTK Query
  const { data: searchResultsData, isFetching: searchLoading } = useSearchCalendarEventsQuery(searchQuery.trim(), {
    skip: !searchQuery.trim(),
  });
  const searchResults = searchResultsData ?? [];

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
    if (selectedEvent) {
      triggerRsvpQuery(selectedEvent._id);
    }
  }, [selectedEvent, triggerRsvpQuery]);

  // Mount and Socket Effects
  useEffect(() => {
    setMounted(true);

    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.on("calendar_event_created", () => refetchEvents());
      socket.on("calendar_event_updated", () => refetchEvents());
      socket.on("calendar_event_deleted", () => refetchEvents());
      socket.on("rsvp_updated", (data) => {
        if (
          selectedEventRef.current &&
          selectedEventRef.current._id === data.eventId
        ) {
          triggerRsvpQuery(data.eventId);
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
  }, [currentDate, refetchEvents, triggerRsvpQuery]);

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
      await updateCalendarEvent({
        id: eventId,
        body: {
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        },
      }).unwrap();
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
      await deleteCalendarEvent(event._id).unwrap();
      setShowDeleteConfirmModal(false);
      setShowDetailPopup(false);
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
        onSuccess={() => refetchEvents()}
        locale={locale}
        editingEvent={editingEvent}
        initialStartDate={initialModalStartDate}
        initialEndDate={initialModalEndDate}
      />

      <ChannelMeetingModal
        isOpen={showChannelMeetingModal}
        onClose={() => setShowChannelMeetingModal(false)}
        onSuccess={() => refetchEvents()}
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
