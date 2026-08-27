import React, { useState, useEffect } from "react";
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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
}

import ChannelMeetingModal from "../../components/dashboard/ChannelMeetingModal";
import EventModal from "../../components/dashboard/EventModal";
import { socket } from "../../lib/socket";

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const router = useRouter();

  // Search states
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // View mode states
  const [viewMode, setViewMode] = useState<"DAY" | "WEEK" | "MONTH" | "YEAR">("WEEK");
  const [viewDropdownVisible, setViewDropdownVisible] = useState(false);

  const fetchCalendar = async () => {
    if (searchActive) return; // Do not fetch default calendar when searching
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("session_token");
      const host = "http://localhost:3001"; // Hoặc API URL nội bộ của mobile
      const start = new Date().toISOString();
      
      let durationDays = 7;
      if (viewMode === "DAY") durationDays = 1;
      else if (viewMode === "WEEK") durationDays = 7;
      else if (viewMode === "MONTH") durationDays = 30;
      else if (viewMode === "YEAR") durationDays = 365;

      const end = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      const response = await fetch(`${host}/api/calendar?start=${start}&end=${end}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Lấy đúng mảng sự kiện (cả từ data.result nếu có)
        const eventList = Array.isArray(data) ? data : data.result ?? [];
        setEvents(eventList);
      }
    } catch (e) {
      console.log("Lỗi tải lịch họp:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSearch = async (query: string) => {
    if (!query.trim()) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("session_token");
      const host = "http://localhost:3001";
      const response = await fetch(`${host}/api/calendar/search?q=${encodeURIComponent(query.trim())}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const eventList = data.result || [];
        setEvents(eventList);
      }
    } catch (e) {
      console.log("Lỗi tìm kiếm lịch họp:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchActive) {
      fetchCalendar();
    } else {
      const delayDebounceFn = setTimeout(() => {
        fetchSearch(searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, searchActive, viewMode]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    const handleRefresh = () => {
      if (!searchActive) {
        fetchCalendar();
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
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCalendar();
  };

  const handleJoin = (meetingCode: string) => {
    router.push(`/meeting/join?code=${meetingCode}`);
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
        onPress={() => {
          if (!isChannelMeeting) {
            setEventToEdit(item);
            setEventModalVisible(true);
          }
        }}
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
          <View style={{ position: "relative", zIndex: 100 }}>
            <TouchableOpacity
              onPress={() => setViewDropdownVisible(!viewDropdownVisible)}
              style={styles.dropdownBtn}
            >
              <Text style={styles.dropdownBtnText}>
                {viewMode === "DAY" && t("calendar.view_day")}
                {viewMode === "WEEK" && t("calendar.view_week")}
                {viewMode === "MONTH" && t("calendar.view_month")}
                {viewMode === "YEAR" && t("calendar.view_year")}
              </Text>
              <Feather name="chevron-down" size={14} color="#0052FF" />
            </TouchableOpacity>

            {viewDropdownVisible && (
              <View style={styles.dropdownMenu}>
                {(["DAY", "WEEK", "MONTH", "YEAR"] as const).map((mode) => {
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
                        {mode === "YEAR" && t("calendar.view_year")}
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

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052FF" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="calendar" size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>
                {searchActive ? t("calendar.no_results") : t("calendar.empty_state")}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
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
        onSuccess={fetchCalendar}
      />

      <EventModal
        visible={eventModalVisible}
        eventToEdit={eventToEdit}
        onClose={() => {
          setEventModalVisible(false);
          setEventToEdit(null);
        }}
        onSuccess={fetchCalendar}
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
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    zIndex: 99,
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
    top: 47, // Đặt ngay dưới button (cách 9px)
    right: 0, // Căn lề phải thẳng hàng với nút bấm
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
});
