"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Users,
  Video,
  GraduationCap,
  Tv,
  Lock,
  XCircle,
  CheckCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Search,
  Filter,
  Bell,
  Menu,
  Copy,
  Trash2,
  ExternalLink,
  Settings,
  Paperclip,
  Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";
import SettingsDialog from "@/components/dashboard/SettingsDialog";
import { socket } from "@/lib/socket";
import StoreProvider from "@/lib/redux/StoreProvider";
import TeamsRichEditor from "@/components/calendar/TeamsRichEditor";
import { useGetMeQuery } from "@/lib/redux/features/users/usersApi";

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  meetingCode: string;
  hostId: string;
  roomType: "meeting" | "classroom" | "livestream" | "private";
  status?: "active" | "cancelled" | "completed";
  recurrenceRule?: string;
  isOccurrence?: boolean;
  occurrenceDate?: string;
  invitees?: { email: string; displayName?: string; status?: string }[];
  hostEmail?: string;
  hostDisplayName?: string;
  hostAvatarUrl?: string;
}

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
  const [view, setView] = useState<
    "day" | "week" | "workweek" | "month" | "agenda"
  >("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Modals & Popups
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<CalendarEvent[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const searchCacheRef = useRef<Record<string, CalendarEvent[]>>({});

  // RSVP Management States & Handlers
  const [rsvpList, setRsvpList] = useState<any[]>([]);
  const [showRsvpDropdown, setShowRsvpDropdown] = useState(false);
  const selectedEventRef = useRef<CalendarEvent | null>(null);

  const fetchRsvpList = async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/${eventId}/rsvp`);
      if (res.ok) {
        const data = await res.json();
        let list = [];
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

  const handleUpdateRSVP = async (eventId: string, status: "ACCEPTED" | "DECLINED" | "TENTATIVE") => {
    try {
      const res = await fetch(`/api/calendar/${eventId}/rsvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchRsvpList(eventId);
        setShowRsvpDropdown(false);
      }
    } catch (e) {
      console.error("Lỗi cập nhật RSVP:", e);
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

  // Điều hướng và highlight sự kiện được chọn từ Search
  const handleSelectSearchEvent = (event: CalendarEvent) => {
    // 1. Highlight
    setHighlightedEventId(event._id);
    setTimeout(() => {
      setHighlightedEventId(null);
    }, 4000); // Highlight nhấp nháy trong 4 giây

    // 2. Chuyển view về tuần (week) để hiển thị lưới giờ nếu đang ở agenda/month
    if (view === "agenda" || view === "month") {
      setView("week");
    }

    // 3. Navigate ngày
    const eventDate = new Date(event.startDate);
    setCurrentDate(eventDate);

    // 4. Đóng search dropdown
    setShowSearch(false);
    setSearchQuery("");

    // 5. Scroll đến lưới giờ bắt đầu của sự kiện
    setTimeout(() => {
      if (calendarGridRef.current) {
        const startHour = eventDate.getHours() + eventDate.getMinutes() / 60;
        // Mỗi ô giờ cao 64px, bắt đầu từ 1 AM. Vị trí scroll top = (startHour - 1) * 64
        const topOffset = Math.max(0, (startHour - 1) * 64);
        calendarGridRef.current.scrollTo({
          top: topOffset,
          behavior: "smooth",
        });
      }
    }, 200); // Chờ 200ms để layout grid render xong
  };

  // Form states
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const descriptionRef = useRef("");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roomType, setRoomType] = useState<
    "meeting" | "classroom" | "livestream" | "private"
  >("meeting");
  const [invitees, setInvitees] = useState("");
  const [recurrence, setRecurrence] = useState("NONE");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const start = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      ).toISOString();
      const end = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      ).toISOString();
      const res = await fetch(`/api/calendar?start=${start}&end=${end}`);
      if (res.ok) {
        const data = await res.json();
        let eventList = [];
        if (data) {
          if (Array.isArray(data)) {
            eventList = data;
          } else if (Array.isArray(data.result)) {
            eventList = data.result;
          } else if (data.result && Array.isArray(data.result.result)) {
            eventList = data.result.result;
          }
        }
        setEvents(eventList);
      }
    } catch (e) {
      console.error("Lỗi fetch events:", e);
    } finally {
      setLoading(false);
    }
  };

  const [selectedInvitees, setSelectedInvitees] = useState<any[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [searchStatusMsg, setSearchStatusMsg] = useState("");

  // Search users callback
  useEffect(() => {
    if (!memberSearchQuery.trim()) {
      setSuggestedUsers([]);
      setSearchStatusMsg("");
      return;
    }

    setIsSearchingMembers(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(memberSearchQuery.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          const results = data && Array.isArray(data.result) ? data.result : [];
          setSuggestedUsers(results);
          if (results.length === 0) {
            setSearchStatusMsg(
              locale === "vi"
                ? "Không tìm thấy người dùng."
                : "No users found.",
            );
          }
        }
      } catch (err) {
        console.error("Lỗi tìm kiếm user:", err);
      } finally {
        setIsSearchingMembers(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [memberSearchQuery, locale]);

  // Realtime Calendar Search Effect (Tối ưu hóa: Cache client, AbortController, Debounce 200ms)
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    // 1. Kiểm tra cache
    if (searchCacheRef.current[trimmedQuery]) {
      setSearchResults(searchCacheRef.current[trimmedQuery]);
      setSearchLoading(false);
      return;
    }

    const abortController = new AbortController();

    // 2. Debounce 200ms
    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/calendar/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: abortController.signal }
        );
        if (res.ok) {
          const data = await res.json();
          
          let results = [];
          if (data) {
            if (Array.isArray(data.result)) {
              results = data.result;
            } else if (data.result && Array.isArray(data.result.result)) {
              results = data.result.result;
            }
          }
          // Lưu vào cache
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
      abortController.abort(); // Hủy request cũ nếu có ký tự mới nhập vào
    };
  }, [searchQuery]);

  const [mounted, setMounted] = useState(false);

  // Handle Auto Focus when Search expands
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  // Handle Click Outside Search to Close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearch(false);
      }
    };
    if (showSearch) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSearch]);

  useEffect(() => {
    setMounted(true);
    fetchEvents();

    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.on("calendar_event_created", () => fetchEvents());
      socket.on("calendar_event_updated", () => fetchEvents());
      socket.on("calendar_event_deleted", () => fetchEvents());
      socket.on("rsvp_updated", (data) => {
        if (selectedEventRef.current && selectedEventRef.current._id === data.eventId) {
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

  if (!mounted) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const now = new Date();
    if (new Date(startDate) <= now) {
      setErrorMsg(
        locale === "vi"
          ? "Thời gian bắt đầu họp phải sau thời gian hiện tại."
          : "Start time must be in the future.",
      );
      return;
    }

    const inviteeList = selectedInvitees.map((usr) => ({
      email: usr.email,
      displayName: usr.displayName || usr.fullName || usr.email,
    }));

    try {
      const payload: any = {
        title,
        description: descriptionRef.current,
        startDate,
        endDate,
        roomType,
        invitees: inviteeList,
      };

      if (recurrence !== "NONE") {
        if (recurrence.includes(";")) {
          // Ví dụ: WEEKLY;BYDAY=FR hoặc MONTHLY;BYDAY=1FR
          const parts = recurrence.split(";");
          const freqPart = parts[0];
          const byDayPart = parts[1] || "";
          payload.recurrenceRule = `FREQ=${freqPart};${byDayPart}`;
        } else {
          payload.recurrenceRule = `FREQ=${recurrence}`;
        }
      }

      const url = editingEventId
        ? `/api/calendar/${editingEventId}?type=all`
        : "/api/calendar";
      const method = editingEventId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.message ||
            (editingEventId
              ? "Không thể cập nhật cuộc họp"
              : "Không thể tạo cuộc họp"),
        );
      }

      setShowCreateModal(false);
      setShowQuickCreate(false);
      setEditingEventId(null);
      setTitle("");
      descriptionRef.current = "";
      setEditorResetKey((prev) => prev + 1);
      localStorage.removeItem("teams_rich_editor_draft_content");
      setStartDate("");
      setEndDate("");
      setSelectedInvitees([]);
      setMemberSearchQuery("");
      fetchEvents();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("text/plain", eventId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");
    const draggedEvent = events.find((ev) => ev._id === eventId);
    if (!draggedEvent) return;

    const duration =
      new Date(draggedEvent.endDate).getTime() -
      new Date(draggedEvent.startDate).getTime();

    // Set thời gian drop tương ứng
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
        fetchEvents();
      }
    } catch (err) {
      console.error("Lỗi cập nhật kéo thả:", err);
    }
  };

  const handleCellClick = (date: Date, hour: number) => {
    setEditingEventId(null);
    setTitle("");
    descriptionRef.current = "";
    setSelectedInvitees([]);
    setRoomType("meeting");
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // Mặc định 1 tiếng

    // Định dạng datetime-local (YYYY-MM-DDTHH:mm)
    const formatDateTimeLocal = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setStartDate(formatDateTimeLocal(start));
    setEndDate(formatDateTimeLocal(end));
    setShowCreateModal(true);
  };

  // Tính toán vị trí tuyệt đối của Event Card trong lưới Grid
  const getEventPositionStyles = (event: CalendarEvent) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    // Giờ bắt đầu và kết thúc thực tế
    let startHour = start.getHours() + start.getMinutes() / 60;
    let endHour = end.getHours() + end.getMinutes() / 60;

    // Nếu kết thúc vào ngày hôm sau, đặt giờ kết thúc của ngày hôm nay là 23 (11 PM)
    if (end.toDateString() !== start.toDateString()) {
      endHour = 23;
    }

    // Giới hạn trong khoảng hiển thị của khung lưới (1 AM đến 11 PM)
    const displayStart = Math.max(1, Math.min(23, startHour));
    const displayEnd = Math.max(1, Math.min(23, endHour));
    const durationHours = Math.max(0.5, displayEnd - displayStart); // Tối thiểu hiển thị nửa tiếng

    // Grid row cao 64px mỗi tiếng (h-16)
    const top = (displayStart - 1) * 64; // Bắt đầu hiển thị từ 1 AM
    const height = durationHours * 64;

    // Đặt chiều cao tối thiểu là 38px để card thon gọn và vừa vặn đẹp mắt
    const finalHeight = Math.max(38, height - 4);
    const offsetTop = (height - finalHeight) / 2;

    return {
      top: `${top + offsetTop}px`,
      height: `${finalHeight}px`,
    };
  };

  // Tính toán layout chiều ngang (left, width) cho các sự kiện bị trùng giờ song song
  const getEventsLayout = (dayEvents: CalendarEvent[]) => {
    interface EventLayout {
      left: string;
      width: string;
    }
    const layouts: Record<string, EventLayout> = {};
    if (dayEvents.length === 0) return layouts;

    // Sắp xếp các sự kiện theo thời gian bắt đầu
    const sorted = [...dayEvents].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    // Tạo các nhóm trùng lặp (Overlap Groups)
    const groups: CalendarEvent[][] = [];
    let currentGroup: CalendarEvent[] = [];
    let groupEnd = 0;

    for (const event of sorted) {
      const start = new Date(event.startDate).getTime();
      const end = new Date(event.endDate).getTime();

      if (currentGroup.length === 0 || start < groupEnd) {
        currentGroup.push(event);
        groupEnd = Math.max(groupEnd, end);
      } else {
        groups.push(currentGroup);
        currentGroup = [event];
        groupEnd = end;
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Chia cột song song cho các event trong mỗi nhóm
    for (const group of groups) {
      const columns: CalendarEvent[][] = [];
      
      for (const event of group) {
        let placed = false;
        const start = new Date(event.startDate).getTime();
        
        for (let i = 0; i < columns.length; i++) {
          const lastInCol = columns[i][columns[i].length - 1];
          const lastEnd = new Date(lastInCol.endDate).getTime();
          
          if (start >= lastEnd) {
            columns[i].push(event);
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([event]);
        }
      }

      const totalCols = columns.length;
      for (let colIdx = 0; colIdx < totalCols; colIdx++) {
        for (const event of columns[colIdx]) {
          const widthPercent = 100 / totalCols;
          const leftPercent = colIdx * widthPercent;
          
          layouts[event._id] = {
            left: `calc(${leftPercent}% + 1.5px)`,
            width: `calc(${widthPercent}% - 3px)`,
          };
        }
      }
    }

    return layouts;
  };

  // Lấy các ngày trong tuần hiện tại
  const getDaysOfWeek = (current: Date) => {
    const temp = new Date(current);
    const day = temp.getDay();
    const diff = temp.getDate() - day; // Tìm ngày CN
    const startOfWeek = new Date(temp.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000));
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek(currentDate);

  // Lọc theo chế độ làm việc (Work Week ẩn thứ 7 và CN)
  const displayedDays = daysOfWeek.filter((d) => {
    if (view === "workweek") {
      return d.getDay() !== 0 && d.getDay() !== 6;
    }
    if (view === "day") {
      return d.toDateString() === currentDate.toDateString();
    }
    return true;
  });

  const hoursRange = Array.from({ length: 23 }, (_, i) => i + 1); // 1 AM đến 11 PM

  const getEventBgColor = (type: string, status?: string) => {
    if (status === "cancelled")
      return "bg-gray-100 border-gray-300 text-gray-500 line-through";
    switch (type) {
      case "classroom":
        return "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-sm";
      case "livestream":
        return "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 shadow-sm";
      case "private":
        return "bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100 shadow-sm";
      default: // meeting
        return "bg-indigo-50 border-indigo-300 text-indigo-800 hover:bg-indigo-100 shadow-sm";
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "classroom":
        return <GraduationCap className="w-3.5 h-3.5" />;
      case "livestream":
        return <Tv className="w-3.5 h-3.5" />;
      case "private":
        return <Lock className="w-3.5 h-3.5" />;
      default:
        return <Video className="w-3.5 h-3.5" />;
    }
  };

  const handleJoinMeeting = (meetingCode: string) => {
    window.location.href = `/room/join?code=${meetingCode}`;
  };

  // Filter & Search events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.description &&
        ev.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === "all" || ev.roomType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleEditClick = (event: CalendarEvent) => {
    setEditingEventId(event._id);
    setTitle(event.title);

    // Định dạng datetime-local cho start/end (YYYY-MM-DDTHH:mm)
    const formatDateTimeLocal = (dStr: string) => {
      const d = new Date(dStr);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setStartDate(formatDateTimeLocal(event.startDate));
    setEndDate(formatDateTimeLocal(event.endDate));
    setRoomType(event.roomType);
    descriptionRef.current = event.description || "";

    // Nạp lại danh sách người tham gia
    if (event.invitees) {
      setSelectedInvitees(
        event.invitees.map((inv) => ({
          email: inv.email,
          displayName: inv.displayName || inv.email,
        })),
      );
    } else {
      setSelectedInvitees([]);
    }

    // Đóng popup chi tiết và mở modal form
    setShowDetailPopup(false);
    setShowCreateModal(true);
  };

  return (
    <div className="h-screen bg-[#f5f5f5] font-sans flex flex-col overflow-hidden text-slate-800">
      {/* ── Local Header Bar ── */}
      <div className="h-[72px] bg-white border-b border-slate-200/60 flex items-center flex-shrink-0 z-[45]">

        {/* LEFT: Cố định = độ rộng sidebar (w-64 = 256px) — Menu + Lịch */}
        <div className="w-64 flex-shrink-0 flex items-center gap-3 px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-[17px] sm:text-lg font-bold text-slate-800 tracking-tight">
              {locale === "vi" ? "Lịch" : "Calendar"}
            </span>
          </div>
        </div>

        {/* RIGHT: flex-1 — tháng/năm + view switcher + điều hướng + tạo lịch */}
        <div className="flex-1 flex items-center justify-between pl-[46px] lg:pl-[54px] pr-4 lg:pr-6 gap-4">

          {/* Tháng/năm — thẳng hàng với đường kẻ phân cách */}
          <h2 className="text-[20px] font-bold text-slate-800 tracking-tight truncate">
            {currentDate
              .toLocaleDateString(
                locale === "vi" ? "vi-VN" : "en-US",
                { month: "long", year: "numeric" },
              )
              .replace(/\u200E/g, "") // Loại bỏ ký tự LTR vô hình nếu có
              .replace(/^./, (c) => c.toUpperCase())}
          </h2>

          {/* Giữa: Bộ chuyển đổi View */}
          <div className="hidden lg:flex justify-center">
            <div className="flex bg-slate-100/70 p-1 rounded-full shadow-inner">
              {(["day", "week", "month", "agenda"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-5 py-1.5 rounded-full text-[13px] font-bold uppercase tracking-wider transition-all duration-200 ${
                    view === v
                      ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {v === "day" && (locale === "vi" ? "Ngày" : "Day")}
                  {v === "week" && (locale === "vi" ? "Tuần" : "Week")}
                  {v === "month" && (locale === "vi" ? "Tháng" : "Month")}
                  {v === "agenda" && (locale === "vi" ? "Năm" : "Year")}
                </button>
              ))}
            </div>
          </div>

          {/* Phải: Điều hướng + Nút Tạo */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Search Component */}
            <div
              ref={searchContainerRef}
              className="relative w-9 h-9 flex items-center justify-center shrink-0"
            >
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                title={locale === "vi" ? "Tìm kiếm" : "Search"}
              >
                <Search className="w-5 h-5" />
              </button>

              {showSearch && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col z-[61]">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm w-40 animate-in fade-in slide-in-from-right-4 duration-200">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={locale === "vi" ? "Tìm kiếm" : "Search"}
                      className="w-full bg-transparent text-sm text-slate-800 focus:outline-none placeholder-slate-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-slate-400 hover:text-slate-600 p-0.5 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Kết quả Tìm kiếm */}
                  {searchQuery.trim() !== "" && (
                    <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] w-60 max-h-64 overflow-y-auto divide-y divide-slate-100 py-1">
                      {searchLoading ? (
                        <div className="px-4 py-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{locale === "vi" ? "Đang tìm kiếm..." : "Searching..."}</span>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 text-center">
                          {locale === "vi" ? "Không tìm thấy kết quả" : "No results found"}
                        </div>
                      ) : (
                        searchResults.map((ev) => (
                          <div
                            key={ev._id}
                            onClick={() => handleSelectSearchEvent(ev)}
                            className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3"
                          >
                            <div className="mt-0.5 text-indigo-500">
                              {getEventIcon(ev.roomType)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {ev.title}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {new Date(ev.startDate).toLocaleString(
                                    locale === "vi" ? "vi-VN" : "en-US",
                                    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                                  )}
                                </span>
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cụm nút điều hướng */}
            <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-full border border-slate-200/50">
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-1.5 hover:bg-white rounded-full text-[13px] font-bold text-slate-700 transition-all shadow-sm"
              >
                {locale === "vi" ? "Hôm nay" : "Today"}
              </button>
              <div className="w-[1px] h-4 bg-slate-200 mx-1 hidden sm:block"></div>
              <button
                onClick={() => {
                  const temp = new Date(currentDate);
                  if (view === "month") temp.setMonth(temp.getMonth() - 1);
                  else if (view === "agenda")
                    temp.setFullYear(temp.getFullYear() - 1);
                  else temp.setDate(temp.getDate() - 7);
                  setCurrentDate(temp);
                }}
                className="p-1.5 hover:bg-white rounded-full text-slate-600 transition-all hidden sm:block"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const temp = new Date(currentDate);
                  if (view === "month") temp.setMonth(temp.getMonth() + 1);
                  else if (view === "agenda")
                    temp.setFullYear(temp.getFullYear() + 1);
                  else temp.setDate(temp.getDate() + 7);
                  setCurrentDate(temp);
                }}
                className="p-1.5 hover:bg-white rounded-full text-slate-600 transition-all hidden sm:block"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Nút Tạo Lịch */}
            <button
              onClick={() => {
                setEditingEventId(null);
                setTitle("");
                descriptionRef.current = "";
                setSelectedInvitees([]);
                setRoomType("meeting");
                const now = new Date();
                const start = new Date(now);
                start.setHours(now.getHours() + 1, 0, 0, 0);
                const end = new Date(start);
                end.setHours(start.getHours() + 1, 0, 0, 0);

                const pad = (n: number) => n.toString().padStart(2, "0");
                setStartDate(
                  `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
                );
                setEndDate(
                  `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`,
                );
                setShowCreateModal(true);
              }}
              className="inline-flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-5 sm:py-2.5 rounded-full bg-brand-500 text-white text-[13px] font-bold hover:bg-brand-600 active:scale-[0.97] transition-all duration-150 shadow-sm shrink-0"
            >
              <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">
                {locale === "vi" ? "Tạo lịch" : "Create"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Calendar Workspace ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative bg-slate-50 p-6">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-white border-r border-slate-200 p-5 flex flex-col gap-6 flex-shrink-0 animate-in slide-in-from-left duration-200">
            {/* Mini Calendar */}
            <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-bold text-slate-800">
                  {currentDate
                    .toLocaleDateString(
                      locale === "vi" ? "vi-VN" : "en-US",
                      { month: "long", year: "numeric" },
                    )
                    .replace(/\u200E/g, "")
                    .replace(/^./, (c) => c.toUpperCase())}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const prevMonth = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() - 1,
                        1,
                      );
                      setCurrentDate(prevMonth);
                    }}
                    className="p-1 hover:bg-slate-200/60 rounded-md text-slate-600 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const nextMonth = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                        1,
                      );
                      setCurrentDate(nextMonth);
                    }}
                    className="p-1 hover:bg-slate-200/60 rounded-md text-slate-600 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Grid 7 columns */}
              <div className="grid grid-cols-7 gap-y-1.5 text-center text-[10px] font-bold text-slate-400 mb-2">
                {locale === "vi"
                  ? ["Cn", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
                      <div key={d}>{d}</div>
                    ))
                  : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d) => <div key={d}>{d}</div>,
                    )}
              </div>

              <div className="grid grid-cols-7 gap-y-1">
                {(() => {
                  const year = currentDate.getFullYear();
                  const month = currentDate.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const startDayOfWeek = firstDay.getDay(); // CN = 0, T2 = 1...

                  // Tính toán lấp đầy 42 ô (6 hàng x 7 ngày)
                  const cells = [];
                  const startDate = new Date(
                    firstDay.getTime() - startDayOfWeek * 24 * 60 * 60 * 1000,
                  );

                  for (let i = 0; i < 42; i++) {
                    cells.push(
                      new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
                    );
                  }

                  return cells.map((cellDate, idx) => {
                    const isToday =
                      cellDate.toDateString() === new Date().toDateString();
                    const isSelected =
                      cellDate.toDateString() === currentDate.toDateString();
                    const isCurrentMonth =
                      cellDate.getMonth() === currentDate.getMonth();

                    // Check if date has events for showing event dot indicator
                    const hasEvents = events.some(
                      (ev) =>
                        new Date(ev.startDate).toDateString() ===
                        cellDate.toDateString(),
                    );

                    return (
                      <button
                        key={idx}
                        onClick={() => setCurrentDate(cellDate)}
                        className={`aspect-square flex flex-col items-center justify-center rounded-full text-[11px] font-semibold transition-all relative ${
                          isSelected
                            ? "bg-indigo-600 text-white font-bold"
                            : isToday
                              ? "border border-indigo-600 text-indigo-600 font-bold"
                              : isCurrentMonth
                                ? "text-slate-800 hover:bg-slate-200/50"
                                : "text-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <span>{cellDate.getDate()}</span>
                        {hasEvents && (
                          <span
                            className={`absolute bottom-1 w-1 h-1 rounded-full ${
                              isSelected ? "bg-white" : "bg-indigo-500"
                            }`}
                          />
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Filter types */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                {locale === "vi" ? "Bộ lọc cuộc họp" : "Meeting Filters"}
              </h3>
              <div className="space-y-1.5">
                {[
                  {
                    value: "all",
                    label: locale === "vi" ? "Tất cả cuộc họp" : "All meetings",
                    color: "bg-slate-200",
                  },
                  {
                    value: "meeting",
                    label:
                      locale === "vi"
                        ? "Meeting (Họp nhóm)"
                        : "Meeting (Group)",
                    color: "bg-indigo-500",
                  },
                  {
                    value: "classroom",
                    label:
                      locale === "vi"
                        ? "Classroom (Lớp học)"
                        : "Classroom (Class)",
                    color: "bg-emerald-500",
                  },
                  {
                    value: "livestream",
                    label: "Livestream",
                    color: "bg-amber-500",
                  },
                  {
                    value: "private",
                    label:
                      locale === "vi"
                        ? "Private (Cá nhân)"
                        : "Private (Personal)",
                    color: "bg-purple-500",
                  },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setTypeFilter(item.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${typeFilter === item.value ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${item.color}`}
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Calendar Grid Section */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Grid Area with absolute positioning */}
          <div ref={calendarGridRef} className="flex-1 overflow-auto px-6 relative">
            {view === "agenda" ? (
              /* Year View (12 Months Grid) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
                {Array.from({ length: 12 }).map((_, monthIdx) => {
                  const year = currentDate.getFullYear();
                  const firstDayOfMonth = new Date(year, monthIdx, 1);
                  const monthName = firstDayOfMonth
                    .toLocaleDateString(
                      locale === "vi" ? "vi-VN" : "en-US",
                      { month: "long" },
                    )
                    .replace(/\u200E/g, "")
                    .replace(/^./, (c) => c.toUpperCase());
                  const startDayOfWeek = firstDayOfMonth.getDay();

                  const monthDays = [];
                  const startOfGrid = new Date(
                    firstDayOfMonth.getTime() -
                      startDayOfWeek * 24 * 60 * 60 * 1000,
                  );
                  for (let i = 0; i < 42; i++) {
                    monthDays.push(
                      new Date(startOfGrid.getTime() + i * 24 * 60 * 60 * 1000),
                    );
                  }

                  return (
                    <div
                      key={monthIdx}
                      className="border border-slate-100 rounded-xl p-3 bg-slate-50/30"
                    >
                      <h4 className="text-xs font-bold text-slate-800 capitalize mb-3">
                        {monthName}
                      </h4>
                      <div className="grid grid-cols-7 gap-y-1 text-center text-[9px] font-bold text-slate-400 mb-1.5">
                        {locale === "vi"
                          ? ["Cn", "T2", "T3", "T4", "T5", "T6", "T7"].map(
                              (d) => <div key={d}>{d}</div>,
                            )
                          : [
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((d) => <div key={d}>{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-y-0.5">
                        {monthDays.map((cellDate, idx) => {
                          const isToday =
                            cellDate.toDateString() ===
                            new Date().toDateString();
                          const isSelected =
                            cellDate.toDateString() ===
                            currentDate.toDateString();
                          const isCurrentMonth =
                            cellDate.getMonth() === monthIdx;

                          const hasEvents = events.some(
                            (ev) =>
                              new Date(ev.startDate).toDateString() ===
                              cellDate.toDateString(),
                          );

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setCurrentDate(cellDate);
                                setView("day");
                              }}
                              className={`aspect-square flex flex-col items-center justify-center rounded-full text-[10px] font-semibold transition-all relative ${
                                isSelected
                                  ? "bg-indigo-600 text-white font-bold"
                                  : isToday
                                    ? "border border-indigo-600 text-indigo-600 font-bold"
                                    : isCurrentMonth
                                      ? "text-slate-800 hover:bg-slate-200/50"
                                      : "text-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              <span>{cellDate.getDate()}</span>
                              {hasEvents && (
                                <span
                                  className={`absolute bottom-0.5 w-0.5 h-0.5 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"}`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : view === "month" ? (
              /* Month View (5-6 Rows Grid Layout) */
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
                {/* Month Grid Header */}
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 h-10 items-center text-center text-xs font-bold text-slate-500">
                  {locale === "vi"
                    ? [
                        "CN",
                        "THỨ 2",
                        "THỨ 3",
                        "THỨ 4",
                        "THỨ 5",
                        "THỨ 6",
                        "THỨ 7",
                      ].map((d) => <div key={d}>{d}</div>)
                    : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
                        (d) => <div key={d}>{d}</div>,
                      )}
                </div>
                {/* Month Grid Cells */}
                <div className="grid grid-cols-7 grid-rows-6 flex-1 divide-x divide-y divide-slate-100">
                  {(() => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const firstDayOfMonth = new Date(year, month, 1);
                    const startDayOfWeek = firstDayOfMonth.getDay();
                    const monthDays = [];
                    const startOfGrid = new Date(
                      firstDayOfMonth.getTime() -
                        startDayOfWeek * 24 * 60 * 60 * 1000,
                    );

                    for (let i = 0; i < 42; i++) {
                      monthDays.push(
                        new Date(
                          startOfGrid.getTime() + i * 24 * 60 * 60 * 1000,
                        ),
                      );
                    }

                    return monthDays.map((cellDate, idx) => {
                      const isToday =
                        cellDate.toDateString() === new Date().toDateString();
                      const isSelected =
                        cellDate.toDateString() === currentDate.toDateString();
                      const isCurrentMonth =
                        cellDate.getMonth() === currentDate.getMonth();

                      const dayEvents = filteredEvents.filter(
                        (ev) =>
                          new Date(ev.startDate).toDateString() ===
                          cellDate.toDateString(),
                      );

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setCurrentDate(cellDate);
                            setView("day");
                          }}
                          className={`p-2 flex flex-col justify-between hover:bg-slate-50/50 transition-colors cursor-pointer min-h-[90px] ${
                            isCurrentMonth
                              ? "bg-white"
                              : "bg-slate-50/20 text-slate-400"
                          } ${isSelected ? "ring-2 ring-indigo-500/20" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                                isToday
                                  ? "bg-indigo-600 text-white font-extrabold"
                                  : isCurrentMonth
                                    ? "text-slate-800"
                                    : "text-slate-300"
                              }`}
                            >
                              {cellDate.getDate() === 1
                                ? `${cellDate.getDate()} thg ${cellDate.getMonth() + 1}`
                                : cellDate.getDate()}
                            </span>
                          </div>

                          {/* Mini events list inside Month Cell */}
                          <div className="flex-1 mt-1 overflow-y-auto space-y-1 max-h-[70px]">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <div
                                key={ev._id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvent(ev);
                                  setShowDetailPopup(true);
                                }}
                                className={`px-1.5 py-0.5 text-[9px] font-semibold border-l-2 rounded-sm truncate ${getEventBgColor(ev.roomType, ev.status)}`}
                              >
                                {ev.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-[8px] text-slate-400 font-bold text-center">
                                +{dayEvents.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              /* Day/Week/Month Grid Views */
              <div
                className="min-w-[800px] bg-white border border-slate-200 rounded-2xl shadow-sm relative"
                style={{ height: `${23 * 64 + 48}px` }}
              >
                {/* Grid Header */}
                <div className="flex border-b border-slate-100 h-12 items-center bg-white sticky top-0 z-30 rounded-t-2xl">
                  <div className="w-20 text-center text-xs font-bold text-slate-400 border-r border-slate-100 bg-white sticky left-0 z-30 h-full flex items-center justify-center">
                    GMT+07
                  </div>
                  {displayedDays.map((date, idx) => (
                    <div
                      key={idx}
                      className="flex-1 text-center flex flex-col justify-center items-center h-full border-r border-slate-100 last:border-0 bg-white"
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {date.toLocaleDateString(
                          locale === "vi" ? "vi-VN" : "en-US",
                          { weekday: "short" },
                        )}
                      </span>
                      <span
                        className={`text-sm font-extrabold mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${date.toDateString() === new Date().toDateString() ? "bg-indigo-600 text-white" : "text-slate-800"}`}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Grid Body */}
                <div
                  className="flex relative"
                  style={{ height: `${23 * 64}px` }}
                >
                  {/* Time labels column */}
                  <div className="w-20 border-r border-slate-100 flex flex-col bg-white sticky left-0 z-20">
                    {hoursRange.map((hour) => (
                      <div
                        key={hour}
                        className="h-16 flex justify-center items-start pt-2 border-b border-slate-50 text-[11px] font-bold text-slate-400 bg-white"
                      >
                        {hour > 12
                          ? `${hour - 12} PM`
                          : hour === 12
                            ? "12 PM"
                            : `${hour} AM`}
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  {displayedDays.map((dayDate, colIdx) => (
                    <div
                      key={colIdx}
                      className="flex-1 border-r border-slate-100 last:border-0 relative h-full flex flex-col overflow-hidden"
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const hourOffset = Math.floor(y / 64) + 1; // Bắt đầu từ 1 AM
                        handleDrop(e, dayDate, hourOffset);
                      }}
                    >
                      {/* Time cell slots */}
                      {hoursRange.map((hour) => (
                        <div
                          key={hour}
                          onClick={() => handleCellClick(dayDate, hour)}
                          className="h-16 border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        />
                      ))}

                      {/* Absolutely positioned events inside the specific column */}
                      {(() => {
                        const dayEvents = filteredEvents.filter(
                          (ev) =>
                            new Date(ev.startDate).toDateString() ===
                            dayDate.toDateString()
                        );
                        const layouts = getEventsLayout(dayEvents);

                        return dayEvents.map((event) => {
                          const { top, height } = getEventPositionStyles(event);
                          const layout = layouts[event._id] || {
                            left: "1.5px",
                            width: "calc(100% - 3px)",
                          };

                          return (
                            <div
                              key={event._id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, event._id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                                setShowDetailPopup(true);
                              }}
                              style={{
                                top,
                                minHeight: height,
                                left: layout.left,
                                width: layout.width,
                              }}
                              className={`absolute h-auto px-3 py-2 rounded-xl border border-l-4 ${getEventBgColor(
                                event.roomType,
                                event.status
                              )} transition-all cursor-pointer overflow-hidden flex flex-col ${
                                parseFloat(height) > 48 ? "justify-between" : "justify-center"
                              } z-10 hover:z-30 hover:shadow-md ${
                                highlightedEventId === event._id
                                  ? "ring-4 ring-indigo-500 ring-offset-2 scale-105 z-50 shadow-xl animate-pulse"
                                  : ""
                              }`}
                            >
                              <div>
                                <div className="flex items-start gap-1.5">
                                  <div className="mt-0.5 shrink-0">
                                    {getEventIcon(event.roomType)}
                                  </div>
                                  <h4 className="font-bold text-xs leading-tight whitespace-normal break-words text-left">
                                    {event.title}
                                  </h4>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Create Event Modal ── */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">
                {locale === "vi"
                  ? "Lên lịch cuộc họp mới"
                  : "Schedule New Meeting"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {errorMsg && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-medium">
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    {locale === "vi" ? "Tiêu đề cuộc họp" : "Meeting Title"}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      locale === "vi"
                        ? "Ví dụ: Sprint Planning"
                        : "e.g., Sprint Planning"
                    }
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      {locale === "vi" ? "Bắt đầu" : "Start"}
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      {locale === "vi" ? "Kết thúc" : "End"}
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {startDate && new Date(startDate) <= new Date() && (
                  <p className="text-red-500 text-[11px] font-semibold mt-1">
                    {locale === "vi"
                      ? "Thời gian bắt đầu họp phải sau thời gian hiện tại."
                      : "Start time must be in the future."}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      {locale === "vi" ? "Lặp lại" : "Recurrence"}
                    </label>
                    <select
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="NONE">
                        {locale === "vi" ? "Không lặp lại" : "Does not repeat"}
                      </option>
                      <option value="DAILY">
                        {locale === "vi" ? "Hàng ngày" : "Daily"}
                      </option>
                      {(() => {
                        if (!startDate) return null;
                        const dateObj = new Date(startDate);
                        if (isNaN(dateObj.getTime())) return null;

                        const daysVi = [
                          "chủ nhật",
                          "thứ hai",
                          "thứ ba",
                          "thứ tư",
                          "thứ năm",
                          "thứ sáu",
                          "thứ bảy",
                        ];
                        const daysEn = [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ];
                        const dayNameVi = daysVi[dateObj.getDay()];
                        const dayNameEn = daysEn[dateObj.getDay()];

                        const dayNum = dateObj.getDate();
                        const weekIndex = Math.ceil(dayNum / 7);
                        const weeksVi = [
                          "đầu tiên",
                          "thứ hai",
                          "thứ ba",
                          "thứ tư",
                          "thứ năm",
                        ];
                        const weeksEn = [
                          "first",
                          "second",
                          "third",
                          "fourth",
                          "fifth",
                        ];
                        const weekNameVi = weeksVi[weekIndex - 1] || "đầu tiên";
                        const weekNameEn = weeksEn[weekIndex - 1] || "first";

                        const rruleDays = [
                          "SU",
                          "MO",
                          "TU",
                          "WE",
                          "TH",
                          "FR",
                          "SA",
                        ];
                        const rruleDay = rruleDays[dateObj.getDay()];

                        const weeklyLabel =
                          locale === "vi"
                            ? `Hàng tuần vào ${dayNameVi}`
                            : `Weekly on ${dayNameEn}`;
                        const monthlyLabel =
                          locale === "vi"
                            ? `Hàng tháng vào ngày ${dayNameVi} ${weekNameVi}`
                            : `Monthly on the ${weekNameEn} ${dayNameEn}`;
                        const yearlyLabel =
                          locale === "vi"
                            ? `Hàng năm vào ngày ${dayNum} tháng ${dateObj.getMonth() + 1}`
                            : `Annually on ${dayNameEn}, ${dateObj.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
                        const weekdayLabel =
                          locale === "vi"
                            ? "Mọi ngày trong tuần (từ thứ Hai đến thứ Sáu)"
                            : "Every weekday (Monday to Friday)";

                        const weeklyVal = `WEEKLY;BYDAY=${rruleDay}`;
                        const monthlyVal = `MONTHLY;BYDAY=${weekIndex}${rruleDay}`;
                        const yearlyVal = `YEARLY`;
                        const weekdayVal = "WEEKLY;BYDAY=MO,TU,WE,TH,FR";

                        return (
                          <>
                            <option value={weeklyVal}>{weeklyLabel}</option>
                            <option value={monthlyVal}>{monthlyLabel}</option>
                            <option value={yearlyVal}>{yearlyLabel}</option>
                            <option value={weekdayVal}>{weekdayLabel}</option>
                          </>
                        );
                      })()}
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    {locale === "vi" ? "Thêm khách" : "Add Guests"}
                  </label>

                  {/* Input Search Box */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => {
                        setMemberSearchQuery(e.target.value);
                        if (e.target.value.trim() === "") {
                          setSuggestedUsers([]);
                          setSearchStatusMsg("");
                        }
                      }}
                      placeholder={
                        locale === "vi"
                          ? "Nhập tên hoặc email..."
                          : "Type name or email..."
                      }
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    />
                    {isSearchingMembers && (
                      <div className="absolute right-3.5 top-3">
                        <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Autocomplete Dropdown List */}
                  {(suggestedUsers.length > 0 || searchStatusMsg) && (
                    <div className="absolute left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-50">
                      {suggestedUsers.map((usr) => {
                        const isAlreadySelected = selectedInvitees.some(
                          (sel) => sel.email === usr.email,
                        );
                        return (
                          <div
                            key={usr._id || usr.email}
                            onClick={() => {
                              if (isAlreadySelected) return;
                              setSelectedInvitees([...selectedInvitees, usr]);
                              setMemberSearchQuery("");
                              setSuggestedUsers([]);
                            }}
                            className={`px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between ${
                              isAlreadySelected
                                ? "opacity-50 cursor-default"
                                : "cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {usr.avatarUrl ? (
                                <img
                                  src={usr.avatarUrl}
                                  alt="avatar"
                                  className="w-7 h-7 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                                  {(
                                    usr.displayName ||
                                    usr.fullName ||
                                    usr.email
                                  )
                                    .substring(0, 1)
                                    .toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">
                                  {usr.displayName || usr.fullName || usr.email}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {usr.email}
                                </span>
                              </div>
                            </div>
                            {isAlreadySelected && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">
                                {locale === "vi" ? "Đã chọn" : "Selected"}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* Email hợp lệ chưa có trong hệ thống (Khách ngoài hệ thống) */}
                      {new RegExp(
                        "^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$",
                      ).test(memberSearchQuery.trim()) &&
                        !suggestedUsers.some(
                          (u) =>
                            u.email.toLowerCase() ===
                            memberSearchQuery.trim().toLowerCase(),
                        ) && (
                          <div
                            onClick={() => {
                              const newExternalUser = {
                                email: memberSearchQuery.trim(),
                                displayName: memberSearchQuery.trim(),
                              };
                              setSelectedInvitees([
                                ...selectedInvitees,
                                newExternalUser,
                              ]);
                              setMemberSearchQuery("");
                              setSuggestedUsers([]);
                              setSearchStatusMsg("");
                            }}
                            className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-3"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                              @
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">
                                {memberSearchQuery.trim()}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {locale === "vi"
                                  ? "Mời khách ngoài hệ thống"
                                  : "Invite external guest"}
                              </span>
                            </div>
                          </div>
                        )}

                      {searchStatusMsg &&
                        !new RegExp(
                          "^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$",
                        ).test(memberSearchQuery.trim()) && (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">
                            {searchStatusMsg}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Selected Invitees List (Google Calendar style list below search bar) */}
                  {selectedInvitees.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                      {selectedInvitees.map((usr) => (
                        <div
                          key={usr._id || usr.email}
                          className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-xl border border-slate-100 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            {usr.avatarUrl ? (
                              <img
                                src={usr.avatarUrl}
                                alt="avatar"
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                                {(usr.displayName || usr.fullName || usr.email)
                                  .substring(0, 1)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">
                                {usr.displayName || usr.fullName || usr.email}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {usr.email}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedInvitees(
                                selectedInvitees.filter(
                                  (sel) => sel.email !== usr.email,
                                ),
                              )
                            }
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2.5">
                    {locale === "vi" ? "Mô tả" : "Description"}
                  </label>
                  <TeamsRichEditor
                    value={descriptionRef.current}
                    onChange={(html) => {
                      descriptionRef.current = html;
                    }}
                    resetKey={editorResetKey}
                    locale={locale}
                    placeholder={
                      locale === "vi"
                        ? "Nội dung tóm tắt cuộc họp..."
                        : "Meeting summary notes..."
                    }
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  {locale === "vi" ? "Hủy" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  {locale === "vi" ? "Lưu" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Event Popup ── */}
      {showDetailPopup && selectedEvent && (
        <div
          onClick={() => setShowDetailPopup(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-[17px]">
                {locale === "vi" ? "Chi tiết lịch họp" : "Meeting Details"}
              </h3>
              <button
                onClick={() => setShowDetailPopup(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-lg font-bold text-slate-900 tracking-tight">
                  {selectedEvent.title}
                </h4>
                
                {/* Microsoft Teams style Action Buttons */}
                {rsvpList && rsvpList.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleJoinMeeting(selectedEvent.meetingCode)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Video className="w-4 h-4" />
                      <span>{locale === 'vi' ? 'Tham gia' : 'Join'}</span>
                    </button>
                    
                    <button className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span>{locale === 'vi' ? 'Trò chuyện' : 'Chat'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    {(() => {
                      const formatDateTime = (dateStr: string) => {
                        const date = new Date(dateStr);
                        const pad = (n: number) => n.toString().padStart(2, "0");
                        return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
                      };
                      return `${formatDateTime(selectedEvent.startDate)} - ${formatDateTime(selectedEvent.endDate)}`;
                    })()}
                  </span>
                </div>
                {selectedEvent.description &&
                  (() => {
                    const match = selectedEvent.description.match(
                      /<div[^>]*data-attachments="([^"]*)"[^>]*><\/div>/,
                    );
                    let cleanHtml = selectedEvent.description;
                    let files: any[] = [];
                    if (match) {
                      cleanHtml = selectedEvent.description.replace(
                        match[0],
                        "",
                      );
                      try {
                        files = JSON.parse(decodeURIComponent(match[1]));
                      } catch (e) {}
                    }
                    const isHtmlEmpty = (htmlStr: string) => {
                      if (!htmlStr) return true;
                      const text = htmlStr.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
                      return text === "";
                    };

                    return (
                      <div className="mt-2 space-y-3">
                        {!isHtmlEmpty(cleanHtml) && (
                          <div
                            className="text-sm bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-500 rich-text-display prose prose-slate max-w-none"
                            dangerouslySetInnerHTML={{ __html: cleanHtml }}
                          />
                        )}
                        {files.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {locale === "vi" ? "Tệp đính kèm" : "Attachments"}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {files.map((f: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-[11px] font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                                >
                                  <Paperclip className="w-3 h-3 text-slate-400" />
                                  <span>{f.name}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>

              {/* Danh sách người tham gia (chỉ hiển thị khi cuộc họp có khách mời) */}
              {rsvpList && rsvpList.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    {locale === "vi" ? "Người tham gia" : "Participants"}
                  </h5>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {/* Người tổ chức (Host) */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        {(selectedEvent as any).hostAvatarUrl ? (
                          <img
                            src={(selectedEvent as any).hostAvatarUrl}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            alt=""
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 uppercase shrink-0">
                            {((selectedEvent as any).hostDisplayName || (selectedEvent as any).hostEmail || "?").substring(0, 1)}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-800 truncate">
                            {(selectedEvent as any).hostDisplayName || (selectedEvent as any).hostEmail?.split('@')[0]}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {(selectedEvent as any).hostEmail}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold uppercase shrink-0">
                        {locale === 'vi' ? 'Người tổ chức' : 'Organizer'}
                      </span>
                    </div>

                    {/* Khách mời */}
                    {rsvpList.map((inv, idx) => {
                      const isResponded = inv.status !== "PENDING";
                      const statusText = isResponded 
                        ? (locale === "vi" ? "Đã phản hồi" : "Responded")
                        : (locale === "vi" ? "Chưa phản hồi" : "No response");

                      let dotColor = "bg-slate-400";
                      if (inv.status === "ACCEPTED") dotColor = "bg-emerald-500";
                      else if (inv.status === "DECLINED") dotColor = "bg-rose-500";
                      else if (inv.status === "TENTATIVE") dotColor = "bg-amber-500";

                      return (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {inv.avatarUrl ? (
                              <img
                                src={inv.avatarUrl}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                alt=""
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 uppercase shrink-0">
                                {inv.displayName ? inv.displayName.substring(0, 1) : "?"}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-800 truncate">
                                {inv.displayName || inv.email.split('@')[0]}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {inv.email}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isResponded ? "text-slate-600" : "text-slate-400"}`}>
                              {statusText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons ở Footer */}
              <div className="flex gap-2 pt-4 w-full border-t border-slate-50">
                {(() => {
                  return (
                    (currentUserId === selectedEvent.hostId ||
                      meData?.supabaseId === selectedEvent.hostId) && (
                      <button
                        onClick={() => handleEditClick(selectedEvent)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                        title={locale === "vi" ? "Chỉnh sửa" : "Edit"}
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-600" />
                        <span>{locale === "vi" ? "Chỉnh sửa" : "Edit"}</span>
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => setShowDeleteConfirmModal(true)}
                  className="px-4 py-2 border border-red-100 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>{locale === "vi" ? "Xóa" : "Delete"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Delete Confirm Modal ── */}
      {showDeleteConfirmModal && selectedEvent && (
        <div
          onClick={() => setShowDeleteConfirmModal(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="font-bold text-slate-800 text-lg mb-3">
              {locale === "vi" ? "Hủy lịch họp" : "Cancel Meeting"}
            </h3>
            <p className="text-sm text-slate-500 mb-7 leading-relaxed">
              {locale === "vi"
                ? "Bạn có chắc chắn muốn hủy lịch họp này không? Hành động này không thể hoàn tác."
                : "Are you sure you want to cancel this meeting? This action cannot be undone."}
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
              >
                {locale === "vi" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/calendar/${selectedEvent._id}?type=all`, {
                    method: "DELETE",
                  });
                  setShowDeleteConfirmModal(false);
                  setShowDetailPopup(false);
                  fetchEvents();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                {locale === "vi" ? "Đồng ý" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog Overlay */}
      {showSettingsDialog && (
        <SettingsDialog onClose={() => setShowSettingsDialog(false)} />
      )}
    </div>
  );
}
