import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import RoleBadge from "./RoleBadge";
import {
  ChannelResponse,
  RoomMemberResponse,
  RoomResponse,
} from "@tobomeet/shared/types";

interface RoomRightDrawerProps {
  visible: boolean;
  onClose: () => void;
  room: RoomResponse;
  membersList: RoomMemberResponse[];
  currentChannel?: ChannelResponse;
  currentUserId: string | undefined;
  onSelectMember: (member: RoomMemberResponse) => void;
}

export default function RoomRightDrawer({
  visible,
  onClose,
  room,
  membersList,
  currentChannel,
  currentUserId,
  onSelectMember,
}: RoomRightDrawerProps) {
  const { t } = useTranslation();

  // State này được mang từ component cha vào để cô lập logic tìm kiếm
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  if (!visible) return null;

  const displayedMembers =
    membersList?.filter((m) => {
      // 1. Kiểm tra quyền hiển thị trong kênh riêng tư
      if (currentChannel?.isPrivate) {
        const isInPrivateChannel =
          m.userId === room?.ownerId ||
          currentChannel?.members?.some((cm) => cm.userId === m.userId);
        if (!isInPrivateChannel) return false;
      }

      // 2. Lọc theo từ khóa tìm kiếm
      if (!memberSearchQuery.trim()) return true;
      const q = memberSearchQuery.trim().toLowerCase();
      return (
        m.displayName?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
      );
    }) || [];

  return (
    <View className="absolute inset-0 z-50 flex-row justify-end">
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
          <Text className="font-bold text-slate-900 text-lg">
            {t("room.in_this_channel")}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="p-1.5 rounded-lg bg-slate-100"
          >
            <Feather name="x" size={16} color="#475569" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-5">
          {/* Members Section */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                {t("room.everyone")} ({displayedMembers.length})
              </Text>
            </View>

            {/* Member Search Bar */}
            <View className="bg-slate-50 border border-slate-200 rounded-xl flex-row items-center px-3 py-1.5 mb-3">
              <Feather
                name="search"
                size={14}
                color="#94A3B8"
                style={{ marginRight: 6 }}
              />
              <TextInput
                value={memberSearchQuery}
                onChangeText={setMemberSearchQuery}
                placeholder={t("room.search_members", {
                  defaultValue: "Tìm thành viên...",
                })}
                placeholderTextColor="#94A3B8"
                className="flex-1 text-xs text-slate-900 py-1"
              />
              {memberSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setMemberSearchQuery("")}>
                  <Feather name="x-circle" size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {displayedMembers.map((m) => {
              const isSelf = m.userId === currentUserId;
              return (
                <View
                  key={m.userId}
                  className="flex-row items-center gap-3 mb-3"
                >
                  <View className="relative">
                    <View className="w-10 h-10 rounded-full bg-blue-100 justify-center items-center overflow-hidden">
                      {m.avatarUrl ? (
                        <Image
                          source={{ uri: m.avatarUrl }}
                          className="w-10 h-10"
                        />
                      ) : (
                        <Text className="font-bold text-blue-600 text-sm">
                          {m.displayName?.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-slate-800">
                      {m.displayName}{" "}
                      {isSelf && (
                        <Text className="text-slate-400 font-normal text-xs">
                          {t("room.you")}
                        </Text>
                      )}
                    </Text>
                    <View className="mt-0.5">
                      {(() => {
                        const tRole = currentChannel?.members?.find(
                          (cm) => cm.userId === m.userId,
                        )?.role;

                        const isRoomOwner =
                          m.role === "owner" || m.userId === room?.ownerId;

                        if (isRoomOwner) {
                          return (
                            <RoleBadge
                              role={m.role}
                              t={t}
                            />
                          );
                        }

                        if (tRole === "admin") {
                          return (
                            <RoleBadge
                              role={tRole}
                              t={t}
                            />
                          );
                        }

                        return (
                          <RoleBadge
                            role="member"
                            t={t}
                          />
                        );
                      })()}
                    </View>
                  </View>

                  {/* Action Menu Trigger (Only for other users) */}
                  {!isSelf && (
                    <TouchableOpacity
                      onPress={() => onSelectMember(m)}
                      className="p-1.5 rounded-lg active:bg-slate-100"
                    >
                      <Feather name="more-vertical" size={18} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Description Section */}
          <View className="border-t border-slate-100 pt-5">
            <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
              {t("room.description")}
            </Text>
            <Text className="text-base text-slate-500 leading-relaxed">
              {room.description ||
                t("room.default_description", {
                  name: room.name,
                  defaultValue: `Không gian làm việc chung dành cho phòng ${room.name}.`,
                })}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
