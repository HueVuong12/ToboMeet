import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  TextInput,
  ScrollView,
  useWindowDimensions,
  PanResponder,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  meetingCode: string;
  roomId?: string;
  channelId?: string;
  roomType?: string;
  invitees?: { email: string; displayName?: string }[];
  recurrenceRule?: string;
  hostId?: string;
  // Pre-fetched fields — populated before opening detail modal
  _prefetchedInvitees?: { email: string; displayName?: string }[];
  _currentUserId?: string | null;
}

import ChannelMeetingModal from "../../components/dashboard/ChannelMeetingModal";
import EventModal from "../../components/dashboard/EventModal";
import MeetingDetailModal from "../../components/dashboard/MeetingDetailModal";
import { socket } from "../../lib/socket";
import { axiosInstance } from "../../lib/axios";
import { supabase } from "../../lib/supabase";

const HOUR_HEIGHT = 60;
const TIME_AXIS_WIDTH = 50;

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEvent | null>(null);
  const [detailPrefetching, setDetailPrefetching] = useState<string | null>(null); // stores _id of event being prefetched
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const router = useRouter();

  // Search states
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // View mode states
  const [viewMode, setViewMode] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  const [viewDropdownVisible, setViewDropdownVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Performance Optimization Refs
  const cache = useRef<Record<string, CalendarEvent[]>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
    const lastDay = new Date(year, month + 1, 0);
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
      end = e.toISOString();
    } else if (mode === "WEEK") {
      const monday = getMonday(date);
      monday.setHours(0, 0, 0, 0);
      start = monday.toISOString();
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
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

  const prefetchNeighbors = async (date: Date, mode: "DAY" | "WEEK" | "MONTH") => {
    const nextDate = new Date(date);
    const prevDate = new Date(date);
    if (mode === "DAY") {
      nextDate.setDate(nextDate.getDate() + 1);
      prevDate.setDate(prevDate.getDate() - 1);
    } else if (mode === "WEEK") {
      nextDate.setDate(nextDate.getDate() + 7);
      prevDate.setDate(prevDate.getDate() - 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
      prevDate.setMonth(prevDate.getMonth() - 1);
    }

    const fetchAndCache = async (d: Date) => {
      const { start, end } = getDateBounds(mode, d);
      const cacheKey = `${start}_${end}`;
      if (cache.current[cacheKey]) return; // already cached
      try {
        const response = await axiosInstance.get(`/calendar?start=${start}&end=${end}`);
        cache.current[cacheKey] = (response as any) || [];
      } catch (e) {
        // Ignore prefetch network cancel or generic errors
      }
    };

    fetchAndCache(nextDate);
    fetchAndCache(prevDate);
  };

  const fetchCalendar = async (targetDate = selectedDate, targetMode = viewMode, skipDebounce = false) => {
    if (searchActive) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const { start, end } = getDateBounds(targetMode, targetDate);
    const cacheKey = `${start}_${end}`;

    if (cache.current[cacheKey]) {
      setEvents(cache.current[cacheKey]);
      setIsFetching(false);
      setInitialLoading(false);
    } else {
      if (events.length === 0) {
        setInitialLoading(true);
      } else {
        setIsFetching(true);
      }
    }

    const performFetch = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await axiosInstance.get(`/calendar?start=${start}&end=${end}`, {
          signal: controller.signal,
        });
        const eventList = response as any;
        cache.current[cacheKey] = eventList || [];
        setEvents(eventList || []);
        prefetchNeighbors(targetDate, targetMode);
      } catch (err: any) {
        if (err.name !== "CanceledError" && err.message !== "canceled") {
          console.log("Lỗi tải lịch họp:", err);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsFetching(false);
          setInitialLoading(false);
        }
      }
    };

    if (skipDebounce) {
      performFetch();
    } else {
      debounceTimeoutRef.current = setTimeout(performFetch, 250);
    }
  };

  const fetchSearch = async (query: string) => {
    if (!query.trim()) {
      setEvents([]);
      return;
    }
    setInitialLoading(true);
    try {
      const data = (await axiosInstance.get(`/calendar/search?q=${encodeURIComponent(query.trim())}`)) as any;
      setEvents(data || []);
    } catch (e) {
      console.log("Lỗi tìm kiếm lịch họp:", e);
    } finally {
      setInitialLoading(false);
    }
  };

  const clearCache = () => {
    cache.current = {};
  };

  useEffect(() => {
    if (!searchActive) {
      fetchCalendar(selectedDate, viewMode, false);
    } else {
      const delayDebounceFn = setTimeout(() => {
        fetchSearch(searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, searchActive, viewMode, selectedDate]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const handleRefresh = () => {
      if (!searchActive) {
        clearCache();
        fetchCalendar(selectedDate, viewMode, true);
      }
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
  }, [selectedDate, viewMode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalendar();
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
              setIsFetching(true);
              await axiosInstance.delete(`/calendar/${event._id}`);
              Alert.alert(
                t("password_reset.password_success") || "Thành công",
                t("calendar.alert_delete_success") || "Xóa sự kiện thành công!"
              );
              cache.current = {};
              fetchCalendar(selectedDate, viewMode, true);
              setDetailModalVisible(false);
              setSelectedEventForDetail(null);
            } catch (err: any) {
              Alert.alert(i18n.language === "vi" ? "Lỗi" : "Error", err?.response?.data?.message || "Error");
            } finally {
              setIsFetching(false);
            }
          },
        },
      ]
    );
  };

  // Pre-fetch session + RSVP data before opening detail modal so all info is ready instantly
  const handleEventPress = useCallback(async (item: CalendarEvent) => {
    setDetailPrefetching(item._id);
    try {
      const [sessionRes, rsvpRes] = await Promise.all([
        supabase.auth.getSession(),
        axiosInstance.get(`/calendar/${item._id}/rsvp`).catch(() => []),
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
      // On error, still open modal with basic event data
      setSelectedEventForDetail({ ...item, _prefetchedInvitees: [], _currentUserId: null });
    } finally {
      setDetailPrefetching(null);
      setDetailModalVisible(true);
    }
  }, []);

  const handleJoin = (meetingCode: string) => {
    router.push(`/meeting/join?code=${meetingCode}`);
  };

  const handlePrev = () => {
    setSelectedDate(prevDate => {
      const nextDate = new Date(prevDate);
      const currentMode = viewModeRef.current;
      if (currentMode === "DAY") {
        nextDate.setDate(nextDate.getDate() - 1);
      } else if (currentMode === "WEEK") {
        nextDate.setDate(nextDate.getDate() - 7);
      } else if (currentMode === "MONTH") {
        nextDate.setMonth(nextDate.getMonth() - 1);
      }
      return nextDate;
    });
  };

  const handleNext = () => {
    setSelectedDate(prevDate => {
      const nextDate = new Date(prevDate);
      const currentMode = viewModeRef.current;
      if (currentMode === "DAY") {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (currentMode === "WEEK") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (currentMode === "MONTH") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      return nextDate;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 40 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 40) {
          handlePrev();
        } else if (gestureState.dx < -40) {
          handleNext();
        }
      },
    })
  ).current;

  const getWeekMonthAndYear = (d: Date) => {
    const dates = getWeekDates(d);
    const monthCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};

    dates.forEach(date => {
      const monthKey = `${date.getMonth() + 1}`;
      const yearKey = `${date.getFullYear()}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
    });

    let maxMonth = d.getMonth() + 1;
    let maxMonthCount = 0;
    Object.keys(monthCounts).forEach(m => {
      if (monthCounts[m] > maxMonthCount) {
        maxMonthCount = monthCounts[m];
        maxMonth = parseInt(m, 10);
      }
    });

    let maxYear = d.getFullYear();
    let maxYearCount = 0;
    Object.keys(yearCounts).forEach(y => {
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
    const clampedEnd = Math.max(1, Math.min(23.99, endHour));
    
    const top = (clampedStart - 1) * HOUR_HEIGHT;
    const height = Math.max(30, (clampedEnd - clampedStart) * HOUR_HEIGHT);
    
    return { top, height };
  };

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

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={isChannelMeeting ? 1 : 0.7}
        disabled={detailPrefetching === item._id}
        onPress={() => handleEventPress(item)}
      >
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{dateStr}</Text>
          <Text style={styles.timeText}>{timeStr}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.title}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description.replace(/<[^>]*>/g, "")}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {isChannelMeeting && (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => {}}
            >
              <Feather name="message-square" size={14} color="#475569" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => {
              if (!isChannelMeeting) {
                handleJoin(item.meetingCode);
              }
            }}
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 23 }, (_, i) => i + 1);
    const colWidth = screenWidth - TIME_AXIS_WIDTH - 24;

    const dayEvents = events.filter(e => {
      const eDate = new Date(e.startDate);
      return eDate.getFullYear() === selectedDate.getFullYear() &&
             eDate.getMonth() === selectedDate.getMonth() &&
             eDate.getDate() === selectedDate.getDate();
    });

    return (
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {/* Timeline headers */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderText}>{getDayHeaderText(selectedDate)}</Text>
        </View>

        <View style={styles.timelineGridContainer}>
          {/* Time axis */}
          <View style={{ width: TIME_AXIS_WIDTH }}>
            {hours.map(hour => (
              <View key={hour} style={{ height: HOUR_HEIGHT, justifyContent: "flex-start", alignItems: "center", paddingTop: 4 }}>
                <Text style={styles.timeLabel}>{`${hour.toString().padStart(2, "0")}:00`}</Text>
              </View>
            ))}
          </View>

          {/* Events & Grid Column */}
          <View style={{ flex: 1, position: "relative" }}>
            {/* Horizontal Grid lines */}
            <View style={StyleSheet.absoluteFill}>
              {hours.map(hour => (
                <View key={hour} style={{ height: HOUR_HEIGHT, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }} />
              ))}
            </View>

            {/* Day Column */}
            <View style={[styles.gridColumn, { width: colWidth }]}>
              {dayEvents.map(event => {
                const { top, height } = getEventLayout(event);
                return (
                  <TouchableOpacity
                    key={`${event._id}_${event.startDate}`}
                    disabled={detailPrefetching === event._id}
                    onPress={() => handleEventPress(event)}
                    style={[
                      styles.eventCard,
                      {
                        top,
                        height,
                        backgroundColor: "#EFF6FF",
                        borderLeftWidth: 4,
                        borderLeftColor: "#0052FF",
                        opacity: isFetching ? 0.6 : 1,
                      }
                    ]}
                  >
                    <Text style={styles.eventTitleText} numberOfLines={2}>
                      {event.title}
                    </Text>
                    {height > 40 && event.description && (
                      <Text style={styles.eventDescText} numberOfLines={1}>
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

  const renderWeekView = () => {
    const hours = Array.from({ length: 23 }, (_, i) => i + 1);
    const weekDates = getWeekDates(selectedDate);
    const remainingWidth = screenWidth - TIME_AXIS_WIDTH - 20;
    const colWidth = remainingWidth / 7;

    const weekdayHeaders = i18n.language === "vi"
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {/* Horizontal columns header */}
        <View style={styles.weekHeaderContainer}>
          <View style={{ width: TIME_AXIS_WIDTH }} />
          <View style={styles.weekDayHeaderRow}>
            {weekDates.map((dayDate, index) => {
              const isToday = new Date().toDateString() === dayDate.toDateString();
              const isSelected = selectedDate.toDateString() === dayDate.toDateString();
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.weekDayHeaderCell, { width: colWidth }, isSelected && styles.weekHeaderCellSelected]}
                  onPress={() => setSelectedDate(dayDate)}
                >
                  <Text style={[styles.weekDayHeaderText, isToday && styles.textPrimary]}>{weekdayHeaders[index]}</Text>
                  <Text style={[styles.weekDayDateText, isToday && styles.textPrimaryBold]}>{dayDate.getDate()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.timelineGridContainer}>
            {/* Time axis */}
            <View style={{ width: TIME_AXIS_WIDTH }}>
              {hours.map(hour => (
                <View key={hour} style={{ height: HOUR_HEIGHT, justifyContent: "flex-start", alignItems: "center", paddingTop: 4 }}>
                  <Text style={styles.timeLabel}>{`${hour.toString().padStart(2, "0")}:00`}</Text>
                </View>
              ))}
            </View>

            {/* Grid & Columns */}
            <View style={{ flex: 1, flexDirection: "row", position: "relative" }}>
              {/* Horizontal Grid lines */}
              <View style={StyleSheet.absoluteFill}>
                {hours.map(hour => (
                  <View key={hour} style={{ height: HOUR_HEIGHT, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }} />
                ))}
              </View>

              {/* Vertical Columns */}
              {weekDates.map((dayDate, index) => {
                const dayEvents = events.filter(e => {
                  const eDate = new Date(e.startDate);
                  return eDate.getFullYear() === dayDate.getFullYear() &&
                         eDate.getMonth() === dayDate.getMonth() &&
                         eDate.getDate() === dayDate.getDate();
                });
                const isToday = new Date().toDateString() === dayDate.toDateString();

                return (
                  <View
                    key={index}
                    style={[
                      styles.gridColumn,
                      {
                        width: colWidth,
                        borderRightWidth: index < 6 ? 1 : 0,
                        borderRightColor: "#E2E8F0",
                        backgroundColor: isToday ? "#0052FF08" : "transparent",
                      }
                    ]}
                  >
                    {dayEvents.map(event => {
                      const { top, height } = getEventLayout(event);
                      return (
                        <TouchableOpacity
                          key={`${event._id}_${event.startDate}`}
                          disabled={detailPrefetching === event._id}
                          onPress={() => handleEventPress(event)}
                          style={[
                            styles.eventCard,
                            {
                              top,
                              height,
                              backgroundColor: "#EFF6FF",
                              borderLeftWidth: 3,
                              borderLeftColor: "#0052FF",
                              opacity: isFetching ? 0.6 : 1,
                            }
                          ]}
                        >
                          <Text style={styles.eventTitleText} numberOfLines={1}>
                            {event.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderMonthView = () => {
    const days = generateMonthDays(selectedDate);
    const currentMonth = selectedDate.getMonth();
    
    const weekDaysHeader = i18n.language === "vi"
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <View style={styles.monthContainer} {...panResponder.panHandlers}>
        {/* Month Weekdays Header */}
        <View style={styles.monthWeekdayRow}>
          {weekDaysHeader.map((d, index) => (
            <View key={index} style={styles.monthWeekdayCell}>
              <Text style={styles.monthWeekdayText}>{d}</Text>
            </View>
          ))}
        </View>
        
        {/* Days Grid */}
        <View style={styles.monthGrid}>
          {days.map((dayDate, index) => {
            const isCurrentMonth = dayDate.getMonth() === currentMonth;
            const isToday = new Date().toDateString() === dayDate.toDateString();
            const isSelected = selectedDate.toDateString() === dayDate.toDateString();
            
            const dayEvents = events.filter(e => {
              const eDate = new Date(e.startDate);
              return eDate.getFullYear() === dayDate.getFullYear() &&
                     eDate.getMonth() === dayDate.getMonth() &&
                     eDate.getDate() === dayDate.getDate();
            });
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthDayCell,
                  !isCurrentMonth && styles.monthDayCellInactive,
                  isSelected && styles.monthDayCellSelected,
                  isToday && styles.monthDayCellToday,
                ]}
                onPress={() => {
                  setSelectedDate(dayDate);
                }}
              >
                <Text
                  style={[
                    styles.monthDayText,
                    !isCurrentMonth && styles.monthDayTextInactive,
                    isSelected && styles.monthDayTextSelected,
                    isToday && styles.monthDayTextToday,
                  ]}
                >
                  {dayDate.getDate()}
                </Text>
                
                <View style={styles.monthEventContainer}>
                  {dayEvents.slice(0, 2).map((event) => (
                    <View
                      key={`${event._id}_${event.startDate}`}
                      style={[
                        styles.monthEventIndicator,
                        { backgroundColor: event.roomType === "channel_meeting" ? "#10B981" : "#0052FF" }
                      ]}
                    />
                  ))}
                  {dayEvents.length > 2 && (
                    <Text style={styles.monthEventMoreText}>+{dayEvents.length - 2}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected date's events list */}
        <View style={styles.monthDetailContainer}>
          <Text style={styles.monthDetailHeader}>
            {selectedDate.toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
              weekday: "long",
              day: "numeric",
              month: "numeric",
            })}
          </Text>
          <FlatList
            data={events.filter(e => {
              const eDate = new Date(e.startDate);
              return eDate.getFullYear() === selectedDate.getFullYear() &&
                     eDate.getMonth() === selectedDate.getMonth() &&
                     eDate.getDate() === selectedDate.getDate();
            })}
            keyExtractor={item => `${item._id}_${item.startDate}`}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={styles.monthDetailEmpty}>{t("calendar.empty_state") || "Không có sự kiện"}</Text>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {searchActive ? (
          <View style={styles.searchBarContainer}>
            <TouchableOpacity onPress={() => { setSearchActive(false); setSearchQuery(""); }} style={styles.backSearchBtn}>
              <Feather name="arrow-left" size={20} color="#475569" />
            </TouchableOpacity>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("calendar.search_placeholder") || "Tìm kiếm..."}
              placeholderTextColor="#94A3B8"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => fetchSearch(searchQuery)}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                <Feather name="x" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>{t("calendar.title")}</Text>
            <TouchableOpacity onPress={() => setSearchActive(true)} style={styles.searchIconBtn}>
              <Feather name="search" size={20} color="#475569" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {!searchActive && (
        <View style={styles.toolbar}>
          <View style={styles.navHeader}>
            <Text style={styles.navHeaderText}>{getHeaderTitle()}</Text>
            {isFetching && (
              <ActivityIndicator size="small" color="#0052FF" style={{ marginLeft: 6 }} />
            )}
          </View>

          <View style={{ position: "relative", zIndex: 100 }}>
            <TouchableOpacity
              onPress={() => setViewDropdownVisible(!viewDropdownVisible)}
              style={styles.dropdownBtn}
            >
              <Text style={styles.dropdownBtnText}>
                {viewMode === "DAY" && t("calendar.view_day")}
                {viewMode === "WEEK" && t("calendar.view_week")}
                {viewMode === "MONTH" && t("calendar.view_month")}
              </Text>
              <Feather name="chevron-down" size={14} color="#0052FF" />
            </TouchableOpacity>

            {viewDropdownVisible && (
              <View style={styles.dropdownMenu}>
                {(["DAY", "WEEK", "MONTH"] as const).map((mode) => {
                  const isActive = viewMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => {
                        setViewMode(mode);
                        setViewDropdownVisible(false);
                      }}
                      style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    >
                      <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>
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

      {viewDropdownVisible && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setViewDropdownVisible(false)}
          style={styles.dropdownOverlay}
        />
      )}

      {initialLoading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : searchActive ? (
        <FlatList
          data={events}
          keyExtractor={(item) => `${item._id}_${item.startDate}`}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="calendar" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>
                {t("calendar.no_results") || "Không tìm thấy kết quả"}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={{ flex: 1 }}>
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
          style={StyleSheet.absoluteFillObject}
        >
          <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.2)" }} />
        </TouchableOpacity>
      )}

      {/* Floating Action Buttons */}
      {fabMenuOpen && (
        <View
          style={{
            position: "absolute",
            right: 24,
            bottom: 96,
            alignItems: "flex-end",
            gap: 12,
            zIndex: 999,
          }}
        >
          {/* Sự kiện Button */}
          <TouchableOpacity
            onPress={() => {
              setFabMenuOpen(false);
              setEventToEdit(null);
              setEventModalVisible(true);
            }}
            style={{
              flexDirection: "row",
              backgroundColor: "#E0E7FF",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              alignItems: "center",
              gap: 8,
              elevation: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 1.41,
            }}
          >
            <Feather name="calendar" size={16} color="#0052FF" />
            <Text style={{ color: "#0052FF", fontWeight: "bold", fontSize: 13 }}>{t("calendar.event")}</Text>
          </TouchableOpacity>

          {/* Cuộc họp kênh Button */}
          <TouchableOpacity
            onPress={() => {
              setFabMenuOpen(false);
              setModalVisible(true);
            }}
            style={{
              flexDirection: "row",
              backgroundColor: "#E0E7FF",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              alignItems: "center",
              gap: 8,
              elevation: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 1.41,
            }}
          >
            <Feather name="check-circle" size={16} color="#0052FF" />
            <Text style={{ color: "#0052FF", fontWeight: "bold", fontSize: 13 }}>{t("calendar.channel_meeting")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Action Button '+' */}
      <TouchableOpacity
        onPress={() => setFabMenuOpen(!fabMenuOpen)}
        style={{
          position: "absolute",
          right: 24,
          bottom: 24,
          backgroundColor: "#0052FF",
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: "center",
          alignItems: "center",
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          zIndex: 1000,
        }}
      >
        <Feather name={fabMenuOpen ? "x" : "plus"} size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <ChannelMeetingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          cache.current = {};
          fetchCalendar(selectedDate, viewMode, true);
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
      />

      <EventModal
        visible={eventModalVisible}
        eventToEdit={eventToEdit}
        onClose={() => {
          setEventModalVisible(false);
          setEventToEdit(null);
        }}
        onSuccess={() => {
          cache.current = {};
          fetchCalendar(selectedDate, viewMode, true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  backSearchBtn: {
    paddingRight: 4,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    zIndex: 99,
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  navBtn: {
    padding: 4,
  },
  navHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  dropdownBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0052FF",
  },
  dropdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 98,
    backgroundColor: "transparent",
  },
  dropdownMenu: {
    position: "absolute",
    top: 47,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    width: 140,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 101,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: "#EFF6FF",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#334155",
  },
  dropdownItemTextActive: {
    fontWeight: "bold",
    color: "#0052FF",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: 4,
  },
  searchIconBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateBlock: {
    alignItems: "center",
    marginRight: 16,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
  },
  timeText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  infoBlock: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  description: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: "#0052FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  chatButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    color: "#64748B",
    marginTop: 12,
    fontSize: 14,
  },

  // Custom views styles
  dayHeader: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  dayHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    textAlign: "center",
  },
  timelineGridContainer: {
    flexDirection: "row",
    paddingRight: 12,
    backgroundColor: "#FFFFFF",
  },
  timeLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  gridColumn: {
    position: "relative",
  },
  eventCard: {
    position: "absolute",
    left: 4,
    right: 4,
    borderRadius: 8,
    padding: 6,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  eventTitleText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1E3A8A",
  },
  eventDescText: {
    fontSize: 9,
    color: "#60A5FA",
    marginTop: 2,
  },

  // Week view styles
  weekHeaderContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingRight: 12,
    paddingVertical: 8,
  },
  weekDayHeaderRow: {
    flex: 1,
    flexDirection: "row",
  },
  weekDayHeaderCell: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRadius: 8,
  },
  weekHeaderCellSelected: {
    backgroundColor: "#EFF6FF",
  },
  weekDayHeaderText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  weekDayDateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 2,
  },
  textPrimary: {
    color: "#0052FF",
  },
  textPrimaryBold: {
    color: "#0052FF",
    fontWeight: "bold",
  },

  // Month view styles
  monthContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  monthWeekdayRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 8,
  },
  monthWeekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  monthWeekdayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  monthDayCell: {
    width: "14.28%",
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRightWidth: 1,
    borderRightColor: "#F1F5F9",
    padding: 4,
    justifyContent: "space-between",
  },
  monthDayCellInactive: {
    backgroundColor: "#F8FAFC",
  },
  monthDayCellSelected: {
    backgroundColor: "#EFF6FF",
  },
  monthDayCellToday: {
    backgroundColor: "#EFF6FF",
  },
  monthDayText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#334155",
  },
  monthDayTextInactive: {
    color: "#94A3B8",
  },
  monthDayTextSelected: {
    color: "#0052FF",
    fontWeight: "bold",
  },
  monthDayTextToday: {
    color: "#0052FF",
    fontWeight: "bold",
  },
  monthEventContainer: {
    flexDirection: "row",
    gap: 2,
    flexWrap: "wrap",
    marginTop: 2,
  },
  monthEventIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthEventIndicatorText: {
    display: "none",
  },
  monthEventMoreText: {
    fontSize: 8,
    color: "#64748B",
    fontWeight: "bold",
  },
  monthDetailContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  monthDetailHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 12,
  },
  monthDetailEmpty: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 24,
  },
});

