import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ChannelResponse, RoomResponse } from "@tobomeet/shared/types";

interface RoomLeftDrawerProps {
  visible: boolean;
  onClose: () => void;
  room: RoomResponse;
  activeChannelId: string | null;
  onSelectChannel: (channelId: string | null) => void;
  isOwner: boolean;
  currentUserId: string | undefined;
  onAddChannel: () => void;
  onManagePrivateChannel: (channel: ChannelResponse) => void;
  onLeaveChannel?: (channel: ChannelResponse) => void;
  onOpenGroupActions: () => void;
  onCopyLink: () => void;
  onGoBack: () => void;
}

export default function RoomLeftDrawer({
  visible,
  onClose,
  room,
  activeChannelId,
  onSelectChannel,
  isOwner,
  currentUserId,
  onAddChannel,
  onManagePrivateChannel,
  onLeaveChannel,
  onOpenGroupActions,
  onCopyLink,
  onGoBack,
}: RoomLeftDrawerProps) {
  const { t } = useTranslation();

  // Trạng thái này chỉ dùng trong Left Drawer nên được chuyển vào đây
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);

  if (!visible || !room) return null;

  return (
    <View className="absolute inset-0 z-50 flex-row">
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="absolute inset-0 bg-black/30"
      />

      {/* Drawer Sheet */}
      <View className="w-[280px] bg-white h-full shadow-2xl flex-col">
        {/* Drawer Header */}
        <View className="px-5 py-4 border-b border-slate-100 flex-row justify-between items-center">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => {
                onClose();
                onGoBack();
              }}
              className="p-1"
            >
              <Feather name="arrow-left" size={20} color="#475569" />
            </TouchableOpacity>

            <View>
              <Text className="font-bold text-slate-900 text-lg">
                {room.name.length > 15
                  ? `${room.name.slice(0, 15)}...`
                  : room.name}
              </Text>
              <View className="flex-row items-center gap-1 mt-0.5">
                <Feather name="video" size={14} color="#0052FF" />
                <Text className="text-sm text-[#0052FF] font-medium">
                  Meeting
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {/* Nút cộng (+) mở rộng danh sách thao tác nhóm */}
            <TouchableOpacity
              onPress={onOpenGroupActions}
              className="p-1.5 rounded-lg bg-slate-100"
            >
              <Feather name="plus" size={16} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="p-1.5 rounded-lg bg-slate-100"
            >
              <Feather name="x" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Channels List */}
        <View className="flex-1 py-4">
          <View className="flex-row justify-between items-center px-5 mb-2">
            <TouchableOpacity
              onPress={() => setIsChannelsExpanded(!isChannelsExpanded)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1"
            >
              <Feather
                name={isChannelsExpanded ? "chevron-down" : "chevron-right"}
                size={16}
                color="#94A3B8"
              />
              <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                {t("room.channels")}
              </Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity onPress={onAddChannel} className="p-1">
                <Feather name="plus" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {isChannelsExpanded && (
            <ScrollView>
              {room.channels?.map((item, index) => {
                const isActive = activeChannelId === item._id;
                const isDefaultChannel = index === 0 || item.name === "General";
                const isAdmin = item.members?.some(
                  (m) => m.userId === currentUserId && m.role === "admin",
                );
                const canManageThisChannel = isOwner || isAdmin;
                const showThreeDots = (item.isPrivate && canManageThisChannel) || (!isOwner && !isDefaultChannel);

                return (
                  <View
                    key={item._id || item.name}
                    className={`flex-row items-center justify-between mx-3 my-1 rounded-xl ${
                      isActive ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        onSelectChannel(item._id || null);
                        onClose();
                      }}
                      className="flex-row items-center flex-1 px-3 py-2.5"
                    >
                      <Feather
                        name={item.isPrivate ? "lock" : "hash"}
                        size={16}
                        color={
                          isActive
                            ? item.isPrivate
                              ? "#D97706"
                              : "#0052FF"
                            : item.isPrivate
                              ? "#D97706"
                              : "#94A3B8"
                        }
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        className={`text-base font-semibold ${
                          isActive ? "text-[#0052FF]" : "text-slate-600"
                        }`}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>

                    {showThreeDots && (
                      <TouchableOpacity
                        onPress={() => {
                          const options: { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }[] = [];

                          if (item.isPrivate && canManageThisChannel) {
                            options.push({
                              text: "Thêm thành viên",
                              onPress: () => onManagePrivateChannel(item),
                            });
                          }

                          if (!isOwner && !isDefaultChannel && onLeaveChannel) {
                            options.push({
                              text: "Rời khỏi kênh",
                              style: "destructive",
                              onPress: () => onLeaveChannel(item),
                            });
                          }

                          options.push({ text: "Hủy", style: "cancel" });

                          import("react-native").then(({ Alert }) => {
                            Alert.alert(`Kênh #${item.name}`, "Tùy chọn kênh", options);
                          });
                        }}
                        className="p-2.5 mr-1"
                      >
                        <Feather
                          name="more-vertical"
                          size={16}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Drawer Footer - Room Code */}
        <View className="p-4 pb-8 border-t border-slate-100 bg-slate-50">
          <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
            {t("room.room_code")}
          </Text>
          <View className="bg-white border border-slate-200 rounded-2xl p-2.5 flex-row items-center justify-between shadow-sm">
            <View className="flex-row items-center pl-2">
              <Text className="text-slate-300 font-bold text-base mr-1">#</Text>
              <Text className="text-slate-800 font-bold text-base">
                {room.code}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onCopyLink}
              className="bg-slate-50/50 border border-slate-200/80 px-3 py-2 rounded-xl flex-row items-center gap-1 active:bg-slate-100"
            >
              <Feather name="copy" size={14} color="#64748B" />
              <Text className="text-xs text-[#64748B] font-bold">
                {t("room.copy_code")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
