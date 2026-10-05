import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  ActivityIndicator,
  SafeAreaView,
  useWindowDimensions,
  PanResponder,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import Toast from "react-native-toast-message";

import {
  CalendarEvent,
  getWeekDates,
  getDateBounds,
  CalendarHeader,
  CalendarDayView,
  CalendarWeekView,
  CalendarMonthView,
  CalendarSearchView,
  CalendarFabMenu,
  EventDetailModal,
  EventModal,
  ChannelEventModal,
} from "../../components/calendar";

import { useCalendarSocketEvents } from "../../hooks/socket/useCalendarSocketEvents";
import { supabase } from "../../lib/supabase";
import {
  calendarApi,
  useGetCalendarEventsQuery,
  useLazyGetCalendarRsvpQuery,
  useDeleteCalendarEventMutation,
  useLazySearchCalendarEventsQuery,
} from "../../lib/redux/api/calendarApi";

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
  const [selectedEventForDetail, setSelectedEventForDetail] =
    useState<CalendarEvent | null>(null);
  const [detailPrefetching, setDetailPrefetching] = useState<string | null>(
    null
  );
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
  } = useGetCalendarEventsQuery({ start, end }, { skip: searchActive });

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

  // Realtime socket event listeners thông qua hook dùng chung
  useCalendarSocketEvents();

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

  const handleDeleteEvent = async (
    event: CalendarEvent,
    deleteType: "single" | "all" = "all"
  ) => {
    try {
      const occurrenceDate =
        event.occurrenceDate ||
        (event.startDate ? event.startDate.substring(0, 10) : undefined);

      await deleteCalendarEvent({
        id: event._id,
        type: deleteType,
        occurrenceDate: deleteType === "single" ? occurrenceDate : undefined,
      }).unwrap();

      Toast.show({
        type: "success",
        text1:
          deleteType === "single"
            ? t("calendar.toasts.delete_single_success", {
              defaultValue: "Đã hủy sự kiện này thành công!",
            })
            : t("calendar.toasts.delete_all_success", {
              defaultValue: "Đã hủy chuỗi sự kiện thành công!",
            }),
      });

      setDetailModalVisible(false);
      setSelectedEventForDetail(null);
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: t("errors.title", { defaultValue: "Lỗi" }),
        text2:
          err?.data?.message ||
          err?.message ||
          t("calendar.toasts.delete_error", {
            defaultValue: "Không thể xóa sự kiện. Vui lòng thử lại!",
          }),
      });
      throw err;
    }
  };

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
        const prefetchedInvitees: any[] = Array.isArray(rsvpRes) ? rsvpRes : [];
        setSelectedEventForDetail({
          ...item,
          _prefetchedInvitees: prefetchedInvitees,
          _currentUserId: currentUserId,
        });
      } catch {
        setSelectedEventForDetail({
          ...item,
          _prefetchedInvitees: [],
          _currentUserId: null,
        });
      } finally {
        setDetailPrefetching(null);
        setDetailModalVisible(true);
      }
    },
    [getCalendarRsvp]
  );

  const handleJoin = (meetingCode: string) => {
    router.push(`/meeting/${meetingCode}`);
  };

  const animateWeekTransition = (
    direction: "left" | "right",
    updateStateFn: () => void
  ) => {
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

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Top Header & Toolbar */}
      <CalendarHeader
        searchActive={searchActive}
        setSearchActive={setSearchActive}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedDate={selectedDate}
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewDropdownVisible={viewDropdownVisible}
        setViewDropdownVisible={setViewDropdownVisible}
        headerTitle={getHeaderTitle()}
        isCalendarFetching={isCalendarFetching}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Main View Area */}
      {isCalendarLoading && !refreshing ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : searchActive ? (
        <CalendarSearchView
          events={events}
          isSearching={isSearching}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEventPress={handleEventPress}
          onJoin={handleJoin}
          detailPrefetching={detailPrefetching}
        />
      ) : (
        <View className="flex-1">
          {viewMode === "DAY" && (
            <CalendarDayView
              selectedDate={selectedDate}
              events={events}
              onEventPress={handleEventPress}
              refreshing={refreshing}
              onRefresh={onRefresh}
              isCalendarFetching={isCalendarFetching}
              detailPrefetching={detailPrefetching}
              panResponderHandlers={panResponder.panHandlers}
              screenWidth={screenWidth}
            />
          )}
          {viewMode === "WEEK" && (
            <CalendarWeekView
              selectedDate={selectedDate}
              onSelectDay={handleSelectDayInWeek}
              events={events}
              onEventPress={handleEventPress}
              onJoin={handleJoin}
              refreshing={refreshing}
              onRefresh={onRefresh}
              isCalendarFetching={isCalendarFetching}
              detailPrefetching={detailPrefetching}
              panResponderHandlers={panResponder.panHandlers}
              translateXAnim={translateXAnim}
              opacityAnim={opacityAnim}
              onPrevWeek={handlePrev}
              onNextWeek={handleNext}
            />
          )}
          {viewMode === "MONTH" && (
            <CalendarMonthView
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              events={events}
              onEventPress={handleEventPress}
              onJoin={handleJoin}
              refreshing={refreshing}
              onRefresh={onRefresh}
              detailPrefetching={detailPrefetching}
              panResponderHandlers={panResponder.panHandlers}
            />
          )}
        </View>
      )}

      {/* Floating Action Menu Button */}
      <CalendarFabMenu
        fabMenuOpen={fabMenuOpen}
        setFabMenuOpen={setFabMenuOpen}
        onOpenCreateEvent={() => {
          setEventToEdit(null);
          setEventModalVisible(true);
        }}
        onOpenCreateChannelEvent={() => setModalVisible(true)}
        onOpenCreateChannelMeeting={() => setModalVisible(true)}
      />

      {/* Modals */}
      <ChannelEventModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          dispatch(calendarApi.util.invalidateTags(["CalendarEvent"]));
        }}
      />

      <EventDetailModal
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
