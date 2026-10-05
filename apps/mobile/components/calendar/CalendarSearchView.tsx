import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { CalendarEvent, getEventColors } from "./types";

interface CalendarSearchViewProps {
  events: CalendarEvent[];
  isSearching: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onEventPress: (event: CalendarEvent) => void;
  onJoin: (meetingCode: string) => void;
  detailPrefetching: string | null;
}

export default function CalendarSearchView({
  events,
  isSearching,
  refreshing,
  onRefresh,
  onEventPress,
  onJoin,
  detailPrefetching,
}: CalendarSearchViewProps) {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === "vi";

  const renderItem = ({ item }: { item: CalendarEvent }) => {
    const startDate = new Date(item.startDate);
    const localeCode = isVi ? "vi-VN" : "en-US";
    const dateStr = startDate.toLocaleDateString(localeCode, {
      day: "2-digit",
      month: "2-digit",
    });
    const timeStr = startDate.toLocaleTimeString(localeCode, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isChannelMeeting =
      item.roomType === "channel_meeting" && item.roomId && item.channelId;
    const isAssignment = item.eventType === "assignment";
    const isRecur = Boolean(item.recurrenceRule || item.isRecurring);
    const colors = getEventColors(item);

    return (
      <TouchableOpacity
        className="bg-white rounded-2xl p-4 mb-2.5 flex-row items-center border border-slate-100"
        style={{ borderLeftColor: colors.border, borderLeftWidth: 4 }}
        activeOpacity={0.7}
        disabled={detailPrefetching === item._id}
        onPress={() => onEventPress(item)}
      >
        <View className="items-center mr-3.5 pr-3.5 border-r border-slate-200">
          <Text className="text-sm font-bold text-slate-800">{dateStr}</Text>
          <Text className="text-xs text-slate-500 mt-1">{timeStr}</Text>
        </View>

        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-1.5">
            {isAssignment ? (
              <Feather name="clipboard" size={13} color={colors.border} />
            ) : isRecur ? (
              <Feather name="repeat" size={11} color="#4F46E5" />
            ) : null}
            <Text
              className="text-sm font-bold text-slate-800 flex-1"
              numberOfLines={1}
            >
              {isAssignment
                ? `[${isVi ? "Nhiệm vụ" : "Assignment"}] ${item.title}`
                : item.title}
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
              <Text
                className="text-[11px] font-bold"
                style={{ color: colors.text }}
              >
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
                  onPress={() => onJoin(item.meetingCode!)}
                >
                  <Text className="text-white font-bold text-xs">
                    {t("calendar.join", { defaultValue: "Tham gia" })}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isSearching) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => `${item._id}_${item.startDate}`}
      renderItem={renderItem}
      ListEmptyComponent={
        <View className="items-center justify-center py-16">
          <Feather name="calendar" size={48} color="#94A3B8" />
          <Text className="text-slate-500 mt-3 text-sm">
            {t("calendar.no_results", {
              defaultValue: "Không tìm thấy kết quả",
            })}
          </Text>
        </View>
      }
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
}
