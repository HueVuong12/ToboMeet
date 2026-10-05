import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  CalendarEvent,
  HOUR_HEIGHT,
  TIME_AXIS_WIDTH,
  getEventColors,
  getEventLayout,
} from "./types";

interface CalendarDayViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onEventPress: (event: CalendarEvent) => void;
  refreshing: boolean;
  onRefresh: () => void;
  isCalendarFetching: boolean;
  detailPrefetching: string | null;
  panResponderHandlers: any;
  screenWidth: number;
}

export default function CalendarDayView({
  selectedDate,
  events,
  onEventPress,
  refreshing,
  onRefresh,
  isCalendarFetching,
  detailPrefetching,
  panResponderHandlers,
  screenWidth,
}: CalendarDayViewProps) {
  const { t, i18n } = useTranslation();
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

  const getDayHeaderText = (date: Date) => {
    const localeCode = isVi ? "vi-VN" : "en-US";
    return date.toLocaleDateString(localeCode, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <View className="flex-1 bg-white" {...panResponderHandlers}>
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
                const isRecur = Boolean(event.recurrenceRule || event.isRecurring);

                return (
                  <TouchableOpacity
                    key={`${event._id}_${event.startDate}`}
                    disabled={detailPrefetching === event._id}
                    onPress={() => onEventPress(event)}
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
                      {isAssignment ? (
                        <Feather
                          name="clipboard"
                          size={12}
                          color={colors.border}
                        />
                      ) : isRecur ? (
                        <Feather name="repeat" size={11} color={colors.text} />
                      ) : null}
                      <Text
                        className="font-bold flex-1 text-xs"
                        style={{ color: colors.text }}
                        numberOfLines={height > 36 ? 2 : 1}
                      >
                        {isAssignment
                          ? `[${
                              isVi ? "Nhiệm vụ" : "Assignment"
                            }] ${event.title}`
                          : event.title}
                      </Text>
                    </View>
                    {height > 40 && event.description && (
                      <Text
                        className="text-[10px] text-slate-500 mt-0.5"
                        numberOfLines={1}
                      >
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
}
