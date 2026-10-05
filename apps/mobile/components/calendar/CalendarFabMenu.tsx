import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

interface CalendarFabMenuProps {
  fabMenuOpen: boolean;
  setFabMenuOpen: (open: boolean) => void;
  onOpenCreateEvent: () => void;
  onOpenCreateChannelEvent?: () => void;
  onOpenCreateChannelMeeting?: () => void;
}

export default function CalendarFabMenu({
  fabMenuOpen,
  setFabMenuOpen,
  onOpenCreateEvent,
  onOpenCreateChannelEvent,
  onOpenCreateChannelMeeting,
}: CalendarFabMenuProps) {
  const { t } = useTranslation();

  const handleOpenChannelEvent = () => {
    setFabMenuOpen(false);
    if (onOpenCreateChannelEvent) {
      onOpenCreateChannelEvent();
    } else if (onOpenCreateChannelMeeting) {
      onOpenCreateChannelMeeting();
    }
  };

  return (
    <>
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
              onOpenCreateEvent();
            }}
            className="flex-row bg-white border border-slate-200 px-4 py-2.5 rounded-full items-center gap-2 active:bg-slate-50"
          >
            <Feather name="calendar" size={16} color="#0052FF" />
            <Text className="text-blue-600 font-bold text-xs">
              {t("calendar.event", { defaultValue: "Sự kiện" })}
            </Text>
          </TouchableOpacity>

          {/* Sự kiện kênh Button */}
          <TouchableOpacity
            onPress={handleOpenChannelEvent}
            className="flex-row bg-white border border-slate-200 px-4 py-2.5 rounded-full items-center gap-2 active:bg-slate-50"
          >
            <Feather name="check-circle" size={16} color="#0052FF" />
            <Text className="text-blue-600 font-bold text-xs">
              {t("calendar.channel_event", {
                defaultValue: t("calendar.channel_meeting", {
                  defaultValue: "Sự kiện kênh",
                }),
              })}
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
    </>
  );
}
