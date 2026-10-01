import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  TextInput,
  ScrollView,
  useWindowDimensions,
  PanResponder,
  FlatList,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import ChannelMeetingModal from "../../components/dashboard/ChannelMeetingModal";
import EventModal from "../../components/dashboard/EventModal";
import MeetingDetailModal from "../../components/dashboard/MeetingDetailModal";
import { socket } from "../../lib/socket";
import { supabase } from "../../lib/supabase";
import {
  calendarApi,
  useGetCalendarEventsQuery,
  useLazyGetCalendarRsvpQuery,
  useDeleteCalendarEventMutation,
  useLazySearchCalendarEventsQuery,
} from "../../lib/redux/api/calendarApi";

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  meetingCode?: string;
  roomId?: string;
  channelId?: string;
  channelIds?: string[];
  roomType?: string;
  invitees?: { email: string; displayName?: string }[];
  recurrenceRule?: string;
  hostId?: string;
  hostDisplayName?: string;
  hostEmail?: string;
  hostAvatarUrl?: string;
  // Assignment specific fields
  eventType?: "meeting" | "assignment";
  assignmentId?: string;
  assignmentStartDate?: string;
  assignmentDueDate?: string;
  assignmentStatus?: "in_progress" | "submitted" | "graded" | "overdue" | "closed";
  // Pre-fetched fields — populated before opening detail modal
  _prefetchedInvitees?: { email: string; displayName?: string }[];
  _currentUserId?: string | null;
}

const HOUR_HEIGHT = 60;
const TIME_AXIS_WIDTH = 50;

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const dispatch = useDispatch();

  // Modals state
  const [modalVisible, setModalVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEvent | null>(null);
  const [detailPrefetching, setDetailPrefetching] = useState<string | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  // Search state
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // View mode states
  const [viewMode, setViewMode] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  const [viewDropdownVisible, setViewDropdownVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Week transition animations
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const getWeekDates = (d: Date) => {
    const monday = getMonday(d);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return day;
    });
  };

  const generateMonthDays = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startOffset);

    const days = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(startDate));
      startDate.setDate(startDate.getDate() + 1);
    }
    return days;
  };

  const getDateBounds = (mode: "DAY" | "WEEK" | "MONTH", date: Date) => {
    let start: string;
    let end: string;
    if (mode === "DAY") {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      start = d.toISOString();
      const e = new Date(d);
      e.setDate(d.getDate() + 1);
      e.setHours(23, 59, 59, 999);
      end = e.toISOString();
    } else if (mode === "WEEK") {
      const monday = getMonday(date);
      monday.setHours(0, 0, 0, 0);
      start = monday.toISOString();
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
      sunday.setHours(23, 59, 59, 999);
      end = sunday.toISOString();
    } else {
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      start = firstDay.toISOString();
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      end = lastDay.toISOString();
    }
    return { start, end };
  };

  // Compute active query bounds
  const { start, end } = useMemo(
    () => getDateBounds(viewMode, selectedDate),
    [viewMode, selectedDate]
  );

  // RTK Query hooks
  const {
    data: calendarEventsData = [],
    isLoading: isCalendarLoading,
    isFetching: isCalendarFetching,
    refetch: refetchCalendar,
  } = useGetCalendarEventsQuery(
    { start, end },
    { skip: searchActive }
  );

  const [
    triggerSearch,
    { data: searchResults = [], isFetching: isSearching },
  ] = useLazySearchCalendarEventsQuery();

  const [deleteCalendarEvent] = useDeleteCalendarEventMutation();
  const [getCalendarRsvp] = useLazyGetCalendarRsvpQuery();

  // Active events list depending on search mode
  const events: CalendarEvent[] = searchActive
    ? (searchResults as CalendarEvent[]) || []
    : (calendarEventsData as CalendarEvent[]) || [];

  // Debounced search trigger
  useEffect(() => {
    if (searchActive) {
      if (!searchQuery.trim()) return;
      const timer = setTimeout(() => {
        triggerSearch(searchQuery.trim());
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchActive, triggerSearch]);

  // Listen to realtime socket events & invalidate RTK Query tags
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const handleRefresh = () => {
      dispatch(calendarApi.util.invalidateTags(["CalendarEvent"]));
    };

    socket.on("calendar_event_created", handleRefresh);
    socket.on("calendar_event_updated", handleRefresh);
    socket.on("calendar_event_deleted", handleRefresh);
    socket.on("calendar_event_received", handleRefresh);
    socket.on("channel_calendar_event_created", handleRefresh);

    return () => {
      socket.off("calendar_event_created", handleRefresh);
      socket.off("calendar_event_updated", handleRefresh);
      socket.off("calendar_event_deleted", handleRefresh);
      socket.off("calendar_event_received", handleRefresh);
      socket.off("channel_calendar_event_created", handleRefresh);
    };
  }, [dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (searchActive && searchQuery.trim()) {
        await triggerSearch(searchQuery.trim()).unwrap();
      } else {
        await refetchCalendar().unwrap();
      }
    } catch {
      // Ignore refresh error
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    Alert.alert(
      t("calendar.delete") || "Xóa sự kiện",
      t("calendar.alert_delete_confirm") || "Bạn có chắc chắn muốn xóa sự kiện này?",
      [
        { text: t("calendar.cancel") || "Hủy", style: "cancel" },
        {
          text: t("calendar.delete") || "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCalendarEvent(event._id).unwrap();
              Alert.alert(
                t("password_reset.password_success") || "Thành công",
                t("calendar.alert_delete_success") || "Xóa sự kiện thành công!"
              );
              setDetailModalVisible(false);
              setSelectedEventForDetail(null);
            } catch (err: any) {
              Alert.alert(
                i18n.language === "vi" ? "Lỗi" : "Error",
                err?.data?.message || err?.message || "Error"
              );
            }
          },
        },
      ]
    );
  };

  const getEventColors = (event: CalendarEvent) => {
    if (event.eventType === "assignment") {
      switch (event.assignmentStatus) {
        case "submitted":
        case "graded":
          return { bg: "#ECFDF5", border: "#10B981", text: "#065F46" };
        case "overdue":
          return { bg: "#FFF1F2", border: "#F43F5E", text: "#9F1239" };
        case "closed":
          return { bg: "#F8FAFC", border: "#64748B", text: "#334155" };
        default: // in_progress
          return { bg: "#EFF6FF", border: "#3B82F6", text: "#1D4ED8" };
      }
    }
    return {
      bg: event.roomType === "channel_meeting" ? "#F0FDF4" : "#EFF6FF",
      border: event.roomType === "channel_meeting" ? "#10B981" : "#0052FF",
      text: event.roomType === "channel_meeting" ? "#065F46" : "#1E40AF",
    };
  };

  // Pre-fetch session + RSVP data before opening detail modal
  const handleEventPress = useCallback(
    async (item: CalendarEvent) => {
      if (item.eventType === "assignment") {
        setSelectedEventForDetail(item);
        setDetailModalVisible(true);
        return;
      }

      setDetailPrefetching(item._id);
      try {
        const [sessionRes, rsvpRes] = await Promise.all([
          supabase.auth.getSession(),
          getCalendarRsvp(item._id).unwrap().catch(() => []),
        ]);
        const currentUserId = sessionRes?.data?.session?.user?.id ?? null;
        const prefetchedInvitees: { email: string; displayName?: string }[] =
          Array.isArray(rsvpRes) ? rsvpRes : [];
        setSelectedEventForDetail({
          ...item,
          _prefetchedInvitees: prefetchedInvitees,
          _currentUserId: currentUserId,
        });
      } catch {
        setSelectedEventForDetail({ ...item, _prefetchedInvitees: [], _currentUserId: null });
      } finally {
        setDetailPrefetching(null);
        setDetailModalVisible(true);
      }
    },
    [getCalendarRsvp]
  );

  const handleJoin = (meetingCode: string) => {
    router.push(`/meeting/join?code=${meetingCode}`);
  };

  const animateWeekTransition = (direction: "left" | "right", updateStateFn: () => void) => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    const outX = direction === "left" ? -80 : 80;
    const inX = direction === "left" ? 80 : -80;

    Animated.parallel([
      Animated.timing(translateXAnim, {
        toValue: outX,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      updateStateFn();
      translateXAnim.setValue(inX);

      Animated.parallel([
        Animated.spring(translateXAnim, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const handleSelectDayInWeek = (dayDate: Date) => {
    if (dayDate.toDateString() === selectedDate.toDateString()) return;
    Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 0.2,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
    setSelectedDate(dayDate);
  };

  const handlePrev = () => {
    if (viewModeRef.current === "WEEK") {
      animateWeekTransition("right", () => {
        setSelectedDate((prevDate) => {
          const nextDate = new Date(prevDate);
          nextDate.setDate(nextDate.getDate() - 7);
          return nextDate;
        });
      });
    } else {
      setSelectedDate((prevDate) => {
        const nextDate = new Date(prevDate);
        if (viewModeRef.current === "DAY") {
          nextDate.setDate(nextDate.getDate() - 1);
        } else if (viewModeRef.current === "MONTH") {
          nextDate.setMonth(nextDate.getMonth() - 1);
        }
        return nextDate;
      });
    }
  };

  const handleNext = () => {
    if (viewModeRef.current === "WEEK") {
      animateWeekTransition("left", () => {
        setSelectedDate((prevDate) => {
          const nextDate = new Date(prevDate);
          nextDate.setDate(nextDate.getDate() + 7);
          return nextDate;
        });
      });
    } else {
      setSelectedDate((prevDate) => {
        const nextDate = new Date(prevDate);
        if (viewModeRef.current === "DAY") {
          nextDate.setDate(nextDate.getDate() + 1);
        } else if (viewModeRef.current === "MONTH") {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        return nextDate;
      });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (viewModeRef.current === "WEEK" && !isAnimating.current) {
          translateXAnim.setValue(gestureState.dx * 0.35);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 45) {
          handlePrev();
        } else if (gestureState.dx < -45) {
          handleNext();
        } else {
          Animated.spring(translateXAnim, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const getWeekMonthAndYear = (d: Date) => {
    const dates = getWeekDates(d);
    const monthCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};

    dates.forEach((date) => {
      const monthKey = `${date.getMonth() + 1}`;
      const yearKey = `${date.getFullYear()}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
    });

    let maxMonth = d.getMonth() + 1;
    let maxMonthCount = 0;
    Object.keys(monthCounts).forEach((m) => {
      if (monthCounts[m] > maxMonthCount) {
        maxMonthCount = monthCounts[m];
        maxMonth = parseInt(m, 10);
      }
    });

    let maxYear = d.getFullYear();
    let maxYearCount = 0;
    Object.keys(yearCounts).forEach((y) => {
      if (yearCounts[y] > maxYearCount) {
        maxYearCount = yearCounts[y];
        maxYear = parseInt(y, 10);
      }
    });

    return { month: maxMonth, year: maxYear };
  };

  const getDayHeaderText = (date: Date) => {
    const localeCode = i18n.language === "vi" ? "vi-VN" : "en-US";
    return date.toLocaleDateString(localeCode, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getHeaderTitle = () => {
    const localeCode = i18n.language === "vi" ? "vi-VN" : "en-US";
    if (viewMode === "DAY") {
      if (i18n.language === "vi") {
        return `Tháng ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;
      } else {
        return selectedDate.toLocaleDateString(localeCode, {
          month: "long",
          year: "numeric",
        });
      }
    } else if (viewMode === "WEEK") {
      const { month, year } = getWeekMonthAndYear(selectedDate);
      if (i18n.language === "vi") {
        return `Tháng ${month}/${year}`;
      } else {
        const refDate = new Date(year, month - 1, 15);
        return refDate.toLocaleDateString(localeCode, {
          month: "long",
          year: "numeric",
        });
      }
    } else {
      return selectedDate.toLocaleDateString(localeCode, {
        month: "long",
        year: "numeric",
      });
    }
  };

  const getEventLayout = (event: CalendarEvent) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    const clampedStart = Math.max(1, Math.min(23, startHour));

    if (event.eventType === "assignment") {
      const top = (clampedStart - 1) * HOUR_HEIGHT;
      const height = 36;
      return { top, height };
    }

    const clampedEnd = Math.max(1, Math.min(23.99, endHour));
    const top = (clampedStart - 1) * HOUR_HEIGHT;
    const height = Math.max(30, (clampedEnd - clampedStart) * HOUR_HEIGHT);

    return { top, height };
  };


  // Standard event card for FlatLists (Month view & Search view)
  const renderItem = ({ item }: { item: CalendarEvent }) => {
    const startDate = new Date(item.startDate);
    const localeCode = i18n.language === "vi" ? "vi-VN" : "en-US";
    const dateStr = startDate.toLocaleDateString(localeCode, {
      day: "2-digit",
      month: "2-digit",
    });
    const timeStr = startDate.toLocaleTimeString(localeCode, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isChannelMeeting = item.roomType === "channel_meeting" && item.roomId && item.channelId;
    const isAssignment = item.eventType === "assignment";
    const colors = getEventColors(item);
    const isVi = i18n.language === "vi";

    return (
      <TouchableOpacity
        className="bg-white rounded-2xl p-4 mb-3 flex-row items-center border border-slate-100"
        style={{ borderLeftColor: colors.border, borderLeftWidth: 4 }}
        activeOpacity={0.7}
        disabled={detailPrefetching === item._id}
        onPress={() => handleEventPress(item)}
      >
        <View className="items-center mr-3.5 pr-3.5 border-r border-slate-200">
          <Text className="text-sm font-bold text-slate-800">{dateStr}</Text>
          <Text className="text-xs text-slate-500 mt-1">{timeStr}</Text>
        </View>

        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-1.5">
            {isAssignment && (
              <Feather name="clipboard" size={13} color={colors.border} />
            )}
            <Text className="text-sm font-bold text-slate-800 flex-1" numberOfLines={1}>
              {isAssignment ? `[${isVi ? "Nhiệm vụ" : "Assignment"}] ${item.title}` : item.title}
            </Text>
          </View>
          {item.description ? (
            <Text className="text-xs text-slate-500 mt-1" numberOfLines={2}>
              {item.description.replace(/<[^>]*>/g, "")}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1.5">
          {isAssignment ? (
            <View
              className="px-2 py-1 rounded-lg border"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
              }}
            >
              <Text className="text-[11px] font-bold" style={{ color: colors.text }}>
                {item.assignmentStatus === "submitted"
                  ? isVi
                    ? "Đã nộp"
                    : "Submitted"
                  : item.assignmentStatus === "graded"
                  ? isVi
                    ? "Đã chấm"
                    : "Graded"
                  : item.assignmentStatus === "overdue"
                  ? isVi
                    ? "Quá hạn"
                    : "Overdue"
                  : item.assignmentStatus === "closed"
                  ? isVi
                    ? "Đã khóa"
                    : "Closed"
                  : isVi
                  ? "Đang làm"
                  : "In Progress"}
              </Text>
            </View>
          ) : (
            <>
              {isChannelMeeting && (
                <View className="w-8 h-8 rounded-lg border border-slate-200 justify-center items-center bg-slate-50">
                  <Feather name="message-square" size={14} color="#475569" />
                </View>
              )}
              {item.meetingCode && !isChannelMeeting && (
                <TouchableOpacity
                  className="bg-blue-600 px-3.5 py-1.5 rounded-xl justify-center items-center active:bg-blue-700"
                  onPress={() => handleJoin(item.meetingCode!)}
                >
                  <Text className="text-white font-bold text-xs">Join</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Rich event card for Week View (stacking cleanly, no collision)
  const renderWeekEventCard = (item: CalendarEvent) => {
    const startDate = new Date(item.startDate);
    const endDate = new Date(item.endDate);
    const localeCode = i18n.language === "vi" ? "vi-VN" : "en-US";
    const startTimeStr = startDate.toLocaleTimeString(localeCode, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTimeStr = endDate.toLocaleTimeString(localeCode, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isChannelMeeting = item.roomType === "channel_meeting" && item.roomId && item.channelId;
    const isAssignment = item.eventType === "assignment";
    const colors = getEventColors(item);
    const isVi = i18n.language === "vi";

    return (
      <TouchableOpacity
        key={`${item._id}_${item.startDate}`}
        activeOpacity={0.7}
        disabled={detailPrefetching === item._id}
        onPress={() => handleEventPress(item)}
        className="rounded-xl bg-white border border-slate-200 p-3"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between mb-1.5">
          <View className="flex-row items-center gap-1.5">
            <Feather name="clock" size={12} color="#64748B" />
            <Text className="text-xs font-semibold text-slate-600">
              {isAssignment ? `${startTimeStr}` : `${startTimeStr} - ${endTimeStr}`}
            </Text>
          </View>

          {isAssignment ? (
            <View
              className="px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
              }}
            >
              <Text className="text-[10px] font-bold" style={{ color: colors.text }}>
                {item.assignmentStatus === "submitted"
                  ? isVi
                    ? "Đã nộp"
                    : "Submitted"
                  : item.assignmentStatus === "graded"
                  ? isVi
                    ? "Đã chấm"
                    : "Graded"
                  : item.assignmentStatus === "overdue"
                  ? isVi
                    ? "Quá hạn"
                    : "Overdue"
                  : item.assignmentStatus === "closed"
                  ? isVi
                    ? "Đã khóa"
                    : "Closed"
                  : isVi
                  ? "Đang làm"
                  : "In Progress"}
              </Text>
            </View>
          ) : isChannelMeeting ? (
            <View className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
              <Text className="text-[10px] font-bold text-emerald-700">
                {isVi ? "Cuộc họp kênh" : "Channel"}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          {isAssignment && (
            <Feather name="clipboard" size={14} color={colors.border} />
          )}
          <Text className="text-sm font-bold text-slate-800 flex-1" numberOfLines={1}>
            {isAssignment ? `[${isVi ? "Nhiệm vụ" : "Assignment"}] ${item.title}` : item.title}
          </Text>
        </View>

        {item.description ? (
          <Text className="text-xs text-slate-500 mt-1" numberOfLines={2}>
            {item.description.replace(/<[^>]*>/g, "")}
          </Text>
        ) : null}

        {!isAssignment && item.meetingCode && !isChannelMeeting && (
          <View className="flex-row justify-end mt-2 pt-2 border-t border-slate-100">
            <TouchableOpacity
              className="bg-blue-600 px-3 py-1.5 rounded-lg flex-row items-center gap-1.5 active:bg-blue-700"
              onPress={() => handleJoin(item.meetingCode!)}
            >
              <Feather name="video" size={12} color="#FFFFFF" />
              <Text className="text-white text-xs font-bold">{isVi ? "Tham gia" : "Join"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Day View
  const renderDayView = () => {
    const hours = Array.from({ length: 23 }, (_, i) => i + 1);
    const colWidth = screenWidth - TIME_AXIS_WIDTH - 24;
    const isVi = i18n.language === "vi";

    const dayEvents = events.filter((e) => {
      const eDate = new Date(e.startDate);
      return (
        eDate.getFullYear() === selectedDate.getFullYear() &&
        eDate.getMonth() === selectedDate.getMonth() &&
        eDate.getDate() === selectedDate.getDate()
      );
    });

    return (
      <View className="flex-1 bg-white" {...panResponder.panHandlers}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Day header */}
          <View className="p-4 bg-white border-b border-slate-200">
            <Text className="text-base font-bold text-slate-800 text-center">
              {getDayHeaderText(selectedDate)}
            </Text>
          </View>

          <View className="flex-row pr-3 bg-white">
            {/* Time axis */}
            <View style={{ width: TIME_AXIS_WIDTH }}>
              {hours.map((hour) => (
                <View
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                  className="justify-start items-center pt-1"
                >
                  <Text className="text-xs text-slate-400 font-medium">
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Events & Grid Column */}
            <View className="flex-1 relative">
              {/* Horizontal Grid lines */}
              <View className="absolute inset-0">
                {hours.map((hour) => (
                  <View
                    key={hour}
                    style={{ height: HOUR_HEIGHT }}
                    className="border-b border-slate-100"
                  />
                ))}
              </View>

              {/* Day Column */}
              <View className="relative" style={{ width: colWidth }}>
                {dayEvents.map((event) => {
                  const { top, height } = getEventLayout(event);
                  const colors = getEventColors(event);
                  const isAssignment = event.eventType === "assignment";
                  return (
                    <TouchableOpacity
                      key={`${event._id}_${event.startDate}`}
                      disabled={detailPrefetching === event._id}
                      onPress={() => handleEventPress(event)}
                      className="absolute left-1 right-1 rounded-xl p-2 justify-center"
                      style={{
                        top,
                        height,
                        backgroundColor: colors.bg,
                        borderLeftWidth: 4,
                        borderLeftColor: colors.border,
                        opacity: isCalendarFetching ? 0.6 : 1,
                      }}
                    >
                      <View className="flex-row items-center gap-1.5">
                        {isAssignment && (
                          <Feather name="clipboard" size={12} color={colors.border} />
                        )}
                        <Text
                          className="font-bold flex-1 text-xs"
                          style={{ color: colors.text }}
                          numberOfLines={height > 36 ? 2 : 1}
                        >
                          {isAssignment
                            ? `[${isVi ? "Nhiệm vụ" : "Assignment"}] ${event.title}`
                            : event.title}
                        </Text>
                      </View>
                      {height > 40 && event.description && (
                        <Text className="text-[10px] text-slate-500 mt-0.5" numberOfLines={1}>
                          {event.description.replace(/<[^>]*>/g, "")}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Week View: Top bar with < and > week nav arrows + 7 day pills, only shows selected day events with transition
  const renderWeekView = () => {
    const weekDates = getWeekDates(selectedDate);
    const isVi = i18n.language === "vi";

    const weekdayHeaders = isVi
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const isToday = new Date().toDateString() === selectedDate.toDateString();

    const selectedDayEvents = events
      .filter((e) => {
        const eDate = new Date(e.startDate);
        return (
          eDate.getFullYear() === selectedDate.getFullYear() &&
          eDate.getMonth() === selectedDate.getMonth() &&
          eDate.getDate() === selectedDate.getDate()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

    return (
      <View className="flex-1 bg-slate-50" {...panResponder.panHandlers}>
        {/* Top Weekday Navigator Bar with Prev & Next Arrows */}
        <View className="bg-white border-b border-slate-200 px-1.5 py-2">
          <View className="flex-row items-center justify-between">
            {/* Left arrow: Previous week */}
            <TouchableOpacity
              onPress={handlePrev}
              activeOpacity={0.6}
              className="w-8 h-12 items-center justify-center rounded-lg active:bg-slate-100"
            >
              <Feather name="chevron-left" size={20} color="#475569" />
            </TouchableOpacity>

            {/* 7 Day Pills */}
            <View className="flex-1 flex-row justify-between items-center mx-1">
              {weekDates.map((dayDate, index) => {
                const dayIsToday = new Date().toDateString() === dayDate.toDateString();
                const isSelected = selectedDate.toDateString() === dayDate.toDateString();

                const dayEventsCount = events.filter((e) => {
                  const eDate = new Date(e.startDate);
                  return (
                    eDate.getFullYear() === dayDate.getFullYear() &&
                    eDate.getMonth() === dayDate.getMonth() &&
                    eDate.getDate() === dayDate.getDate()
                  );
                }).length;

                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    className={`items-center justify-center py-2 px-1 rounded-xl flex-1 mx-0.5 ${
                      isSelected
                        ? "bg-blue-600"
                        : dayIsToday
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-slate-50 border border-slate-100"
                    }`}
                    onPress={() => handleSelectDayInWeek(dayDate)}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        isSelected
                          ? "text-white"
                          : dayIsToday
                          ? "text-blue-600 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      {weekdayHeaders[index]}
                    </Text>
                    <Text
                      className={`text-sm font-bold mt-0.5 ${
                        isSelected
                          ? "text-white"
                          : dayIsToday
                          ? "text-blue-600 font-extrabold"
                          : "text-slate-800"
                      }`}
                    >
                      {dayDate.getDate()}
                    </Text>
                    {dayEventsCount > 0 && (
                      <View
                        className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          isSelected ? "bg-white" : "bg-blue-600"
                        }`}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Right arrow: Next week */}
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.6}
              className="w-8 h-12 items-center justify-center rounded-lg active:bg-slate-100"
            >
              <Feather name="chevron-right" size={20} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Animated Content: Displays ONLY the events for selectedDate */}
        <Animated.View
          style={{
            flex: 1,
            transform: [{ translateX: translateXAnim }],
            opacity: opacityAnim,
          }}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Selected Day Info Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold text-slate-800">
                  {getDayHeaderText(selectedDate)}
                </Text>
                {isToday && (
                  <View className="bg-blue-600 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {isVi ? "Hôm nay" : "Today"}
                    </Text>
                  </View>
                )}
              </View>

              {!isCalendarFetching && (
                <View className="px-2.5 py-0.5 rounded-full bg-slate-200">
                  <Text className="text-xs font-semibold text-slate-600">
                    {selectedDayEvents.length} {isVi ? "cuộc họp" : "meetings"}
                  </Text>
                </View>
              )}
            </View>

            {/* Loading State */}
            {isCalendarFetching ? (
              <View className="py-20 items-center justify-center">
                <ActivityIndicator size="large" color="#0052FF" />
                <Text className="text-xs text-slate-400 font-medium mt-3">
                  {isVi ? "Đang tải lịch trình..." : "Loading schedule..."}
                </Text>
              </View>
            ) : selectedDayEvents.length === 0 ? (
              /* Empty state message requested by user: "Không có lịch họp nào cho ngày này" */
              <View className="py-16 px-6 items-center justify-center bg-white rounded-2xl border border-slate-200 my-2">
                <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                  <Feather name="calendar" size={26} color="#3B82F6" />
                </View>
                <Text className="text-base font-bold text-slate-700 text-center">
                  {isVi
                    ? "Không có lịch họp nào cho ngày này"
                    : "No meetings scheduled for this day"}
                </Text>
                <Text className="text-xs text-slate-400 text-center mt-1.5">
                  {isVi
                    ? "Hãy chọn ngày khác hoặc tạo lịch họp mới"
                    : "Select another day or schedule a new meeting"}
                </Text>
              </View>
            ) : (
              /* Events for Selected Day */
              <View className="gap-3">
                {selectedDayEvents.map((event) => renderWeekEventCard(event))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  // Month View
  const renderMonthView = () => {
    const days = generateMonthDays(selectedDate);
    const currentMonth = selectedDate.getMonth();
    const isVi = i18n.language === "vi";

    const weekDaysHeader = isVi
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const selectedDayEvents = events.filter((e) => {
      const eDate = new Date(e.startDate);
      return (
        eDate.getFullYear() === selectedDate.getFullYear() &&
        eDate.getMonth() === selectedDate.getMonth() &&
        eDate.getDate() === selectedDate.getDate()
      );
    });

    return (
      <View className="flex-1 bg-white" {...panResponder.panHandlers}>
        {/* Month Weekdays Header */}
        <View className="flex-row border-b border-slate-200 py-2.5 bg-slate-50">
          {weekDaysHeader.map((d, index) => (
            <View key={index} className="flex-1 items-center">
              <Text className="text-xs font-semibold text-slate-500">{d}</Text>
            </View>
          ))}
        </View>

        {/* Days Grid */}
        <View className="flex-row flex-wrap border-b border-slate-200">
          {days.map((dayDate, index) => {
            const isCurrentMonth = dayDate.getMonth() === currentMonth;
            const isToday = new Date().toDateString() === dayDate.toDateString();
            const isSelected = selectedDate.toDateString() === dayDate.toDateString();

            const dayEvents = events.filter((e) => {
              const eDate = new Date(e.startDate);
              return (
                eDate.getFullYear() === dayDate.getFullYear() &&
                eDate.getMonth() === dayDate.getMonth() &&
                eDate.getDate() === dayDate.getDate()
              );
            });

            return (
              <TouchableOpacity
                key={index}
                className={`w-[14.28%] h-14 border-b border-r border-slate-100 p-1 justify-between ${
                  isSelected
                    ? "bg-blue-50/80"
                    : isToday
                    ? "bg-blue-50/40"
                    : !isCurrentMonth
                    ? "bg-slate-50/60"
                    : "bg-white"
                }`}
                onPress={() => setSelectedDate(dayDate)}
              >
                <View className="flex-row justify-between items-center">
                  <View
                    className={`w-5 h-5 rounded-full items-center justify-center ${
                      isSelected
                        ? "bg-blue-600"
                        : isToday
                        ? "bg-blue-100"
                        : ""
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        isSelected
                          ? "text-white font-bold"
                          : isToday
                          ? "text-blue-600 font-bold"
                          : !isCurrentMonth
                          ? "text-slate-300"
                          : "text-slate-700"
                      }`}
                    >
                      {dayDate.getDate()}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-0.5 flex-wrap">
                  {dayEvents.slice(0, 3).map((event) => {
                    const colors = getEventColors(event);
                    return (
                      <View
                        key={`${event._id}_${event.startDate}`}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: colors.border }}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <Text className="text-[8px] text-slate-500 font-bold">
                      +{dayEvents.length - 3}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected date's events list */}
        <View className="flex-1 bg-slate-50 p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-slate-700">
              {selectedDate.toLocaleDateString(isVi ? "vi-VN" : "en-US", {
                weekday: "long",
                day: "numeric",
                month: "numeric",
              })}
            </Text>
            <View className="px-2 py-0.5 rounded-full bg-slate-200/60">
              <Text className="text-[11px] font-medium text-slate-600">
                {selectedDayEvents.length} {isVi ? "sự kiện" : "events"}
              </Text>
            </View>
          </View>
          <FlatList
            data={selectedDayEvents}
            keyExtractor={(item) => `${item._id}_${item.startDate}`}
            renderItem={renderItem}
            ListEmptyComponent={
              <View className="py-8 items-center justify-center">
                <Feather name="calendar" size={32} color="#CBD5E1" />
                <Text className="text-sm text-slate-400 mt-2">
                  {t("calendar.empty_state") || "Không có sự kiện"}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header / Search Header */}
      <View className="px-5 py-3.5 border-b border-slate-200 bg-white flex-row items-center justify-between">
        {searchActive ? (
          <View className="flex-row items-center flex-1 gap-3">
            <TouchableOpacity
              onPress={() => {
                setSearchActive(false);
                setSearchQuery("");
              }}
              className="p-1"
            >
              <Feather name="arrow-left" size={20} color="#475569" />
            </TouchableOpacity>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("calendar.search_placeholder") || "Tìm kiếm..."}
              placeholderTextColor="#94A3B8"
              autoFocus
              returnKeyType="search"
              className="flex-1 text-base text-slate-800 py-1"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} className="p-1">
                <Feather name="x" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <Text className="text-xl font-bold text-slate-900">{t("calendar.title")}</Text>
            <TouchableOpacity
              onPress={() => setSearchActive(true)}
              className="w-9 h-9 rounded-full bg-slate-100 justify-center items-center active:bg-slate-200"
            >
              <Feather name="search" size={18} color="#475569" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Toolbar: Navigation title & View mode switcher */}
      {!searchActive && (
        <View className="px-4 py-3 flex-row justify-between items-center bg-white border-b border-slate-100 z-30">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handlePrev}
              className="p-1.5 rounded-full active:bg-slate-100"
            >
              <Feather name="chevron-left" size={20} color="#475569" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-slate-800">{getHeaderTitle()}</Text>
            <TouchableOpacity
              onPress={handleNext}
              className="p-1.5 rounded-full active:bg-slate-100"
            >
              <Feather name="chevron-right" size={20} color="#475569" />
            </TouchableOpacity>
            {isCalendarFetching && (
              <ActivityIndicator size="small" color="#0052FF" className="ml-1" />
            )}
          </View>

          <View className="relative z-30">
            <TouchableOpacity
              onPress={() => setViewDropdownVisible(!viewDropdownVisible)}
              className="flex-row items-center bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full gap-1.5"
            >
              <Text className="text-xs font-bold text-blue-600">
                {viewMode === "DAY" && t("calendar.view_day")}
                {viewMode === "WEEK" && t("calendar.view_week")}
                {viewMode === "MONTH" && t("calendar.view_month")}
              </Text>
              <Feather name="chevron-down" size={14} color="#0052FF" />
            </TouchableOpacity>

            {viewDropdownVisible && (
              <View className="absolute top-10 right-0 bg-white rounded-xl p-1.5 w-32 border border-slate-200 z-50">
                {(["DAY", "WEEK", "MONTH"] as const).map((mode) => {
                  const isActive = viewMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => {
                        setViewMode(mode);
                        setViewDropdownVisible(false);
                      }}
                      className={`py-2 px-3 rounded-lg ${isActive ? "bg-blue-50" : ""}`}
                    >
                      <Text
                        className={`text-xs ${
                          isActive ? "font-bold text-blue-600" : "text-slate-600"
                        }`}
                      >
                        {mode === "DAY" && t("calendar.view_day")}
                        {mode === "WEEK" && t("calendar.view_week")}
                        {mode === "MONTH" && t("calendar.view_month")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Overlay to close view dropdown */}
      {viewDropdownVisible && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setViewDropdownVisible(false)}
          className="absolute inset-0 z-20"
        />
      )}

      {/* Main View Area */}
      {isCalendarLoading && !refreshing ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : searchActive ? (
        isSearching ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#0052FF" />
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => `${item._id}_${item.startDate}`}
            renderItem={renderItem}
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <Feather name="calendar" size={48} color="#94A3B8" />
                <Text className="text-slate-500 mt-3 text-sm">
                  {t("calendar.no_results") || "Không tìm thấy kết quả"}
                </Text>
              </View>
            }
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )
      ) : (
        <View className="flex-1">
          {viewMode === "DAY" && renderDayView()}
          {viewMode === "WEEK" && renderWeekView()}
          {viewMode === "MONTH" && renderMonthView()}
        </View>
      )}

      {/* Floating Action Menu Overlay */}
      {fabMenuOpen && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setFabMenuOpen(false)}
          className="absolute inset-0 bg-slate-900/40 z-40"
        />
      )}

      {/* Floating Action Buttons */}
      {fabMenuOpen && (
        <View className="absolute right-6 bottom-24 items-end gap-3 z-50">
          {/* Sự kiện Button */}
          <TouchableOpacity
            onPress={() => {
              setFabMenuOpen(false);
              setEventToEdit(null);
              setEventModalVisible(true);
            }}
            className="flex-row bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-full items-center gap-2 active:bg-indigo-100"
          >
            <Feather name="calendar" size={16} color="#0052FF" />
            <Text className="text-blue-600 font-bold text-xs">{t("calendar.event")}</Text>
          </TouchableOpacity>

          {/* Cuộc họp kênh Button */}
          <TouchableOpacity
            onPress={() => {
              setFabMenuOpen(false);
              setModalVisible(true);
            }}
            className="flex-row bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-full items-center gap-2 active:bg-indigo-100"
          >
            <Feather name="check-circle" size={16} color="#0052FF" />
            <Text className="text-blue-600 font-bold text-xs">
              {t("calendar.channel_meeting")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button '+' */}
      <TouchableOpacity
        onPress={() => setFabMenuOpen(!fabMenuOpen)}
        className="absolute right-6 bottom-6 bg-blue-600 w-14 h-14 rounded-full justify-center items-center z-50 active:scale-95"
      >
        <Feather name={fabMenuOpen ? "x" : "plus"} size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modals */}
      <ChannelMeetingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          dispatch(calendarApi.util.invalidateTags(["CalendarEvent"]));
        }}
      />

      <MeetingDetailModal
        visible={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedEventForDetail(null);
        }}
        event={selectedEventForDetail}
        onEdit={(evt) => {
          setDetailModalVisible(false);
          setSelectedEventForDetail(null);
          setEventToEdit(evt);
          setEventModalVisible(true);
        }}
        onDelete={handleDeleteEvent}
        onJoin={(meetingCode) => {
          handleJoin(meetingCode);
        }}
        onRefresh={() => {
          dispatch(calendarApi.util.invalidateTags(["CalendarEvent"]));
        }}
      />

      <EventModal
        visible={eventModalVisible}
        eventToEdit={eventToEdit}
        onClose={() => {
          setEventModalVisible(false);
          setEventToEdit(null);
        }}
        onSuccess={() => {
          dispatch(calendarApi.util.invalidateTags(["CalendarEvent"]));
        }}
      />
    </SafeAreaView>
  );
}
