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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  meetingCode: string;
}

export default function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("session_token");
      const host = "http://localhost:3001"; // Hoặc API URL nội bộ của mobile
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 ngày tới

      const response = await fetch(`${host}/api/calendar?start=${start}&end=${end}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (e) {
      console.log("Lỗi tải lịch họp:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
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
    const dateStr = startDate.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
    const timeStr = startDate.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View style={styles.card}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{dateStr}</Text>
          <Text style={styles.timeText}>{timeStr}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.title}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => handleJoin(item.meetingCode)}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lịch biểu</Text>
      </View>

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
              <Text style={styles.emptyText}>Chưa có cuộc họp nào được lên lịch</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0F172A",
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
