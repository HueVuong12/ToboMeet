import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ChannelResponse, RoomResponse } from "@tobomeet/shared/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RoomLeftDrawerProps {
  visible: boolean;
  onClose: () => void;
  room: RoomResponse;
  activeChannelId: string | null;
  onSelectChannel: (channelId: string | null) => void;
  isOwner: boolean;
  isRoomVice: boolean;
  currentUserId: string | undefined;
  onAddChannel: () => void;
  onManagePrivateChannel: (channel: ChannelResponse) => void;
  onLeaveChannel?: (channel: ChannelResponse) => void;
  onRenameChannel?: (channel: ChannelResponse) => void;
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
  isRoomVice,
  currentUserId,
  onAddChannel,
  onManagePrivateChannel,
  onLeaveChannel,
  onRenameChannel,
  onOpenGroupActions,
  onCopyLink,
  onGoBack,
}: RoomLeftDrawerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Trạng thái này chỉ dùng trong Left Drawer nên được chuyển vào đây
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);
  const [selectedChannelForMenu, setSelectedChannelForMenu] = useState<ChannelResponse | null>(null);

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

        {/* Nhiệm vụ Section */}
        <View className="px-3 pt-3 pb-2 border-b border-slate-100">
          <TouchableOpacity
            onPress={() => {
              onSelectChannel("__assignments__");
              onClose();
            }}
            className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50/70 active:bg-blue-100"
          >
            <Feather name="file-text" size={18} color="#0052FF" />
            <Text className="font-bold text-[#0052FF] text-base">
              {t("room.assignments", { defaultValue: "Nhiệm vụ" })}
            </Text>
          </TouchableOpacity>
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
                // Phó nhóm cấp phòng (isRoomVice) có quyền quản lý mọi kênh
                // Phó nhóm cấp kênh (isAdmin) chỉ có quyền quản lý kênh đó
                const canManageThisChannel = isOwner || isRoomVice || isAdmin;

                const isChannelMember = item.isPrivate
                  ? (item.members?.some((m) => m.userId === currentUserId) ??
                    false)
                  : false;

                // Hiển thị 3-dot menu cho kênh:
                // - Trưởng nhóm hoặc Phó nhóm có toàn quyền quản lý/đổi tên trên bất kỳ kênh nào.
                // - Đối với thành viên thường, chỉ hiện 3-dot ở kênh riêng tư (không phải mặc định) để họ rời kênh.
                const showThreeDots =
                  (isOwner || isRoomVice) ||
                  (item.isPrivate && !isDefaultChannel && isChannelMember);


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
                          setSelectedChannelForMenu(item);
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

      {/* Modal bottom sheet for Channel Actions */}
      <Modal
        visible={!!selectedChannelForMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedChannelForMenu(null)}
      >
        <View
          className="flex-1 justify-end bg-black/50"
          style={{ paddingBottom: insets.bottom }}
        >
          {/* Backdrop */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSelectedChannelForMenu(null)}
            className="absolute inset-0"
          />
          <View className="bg-white rounded-t-3xl p-6 shadow-2xl">
            {/* Handle & Title */}
            <View className="items-center mb-6">
              <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
              <Text className="font-bold text-slate-800 text-lg mt-4">
                Thao tác kênh
              </Text>
            </View>

            {/* Thêm thành viên */}
            {selectedChannelForMenu?.isPrivate &&
              (isOwner || isRoomVice || selectedChannelForMenu.members?.some(
                (m) => m.userId === currentUserId && m.role === "admin",
              )) && (
                <TouchableOpacity
                  onPress={() => {
                    const channel = selectedChannelForMenu;
                    setSelectedChannelForMenu(null);
                    if (channel) {
                      onManagePrivateChannel(channel);
                    }
                  }}
                  className="flex-row items-center gap-4 py-4 border-b border-slate-100/80"
                >
                  <Feather name="user-plus" size={18} color="#475569" />
                  <Text className="text-slate-700 text-base font-semibold">
                    Thêm thành viên
                  </Text>
                </TouchableOpacity>
              )}

            {/* Đổi tên kênh */}
            {(isOwner || isRoomVice || selectedChannelForMenu?.members?.some(
              (m) => m.userId === currentUserId && m.role === "admin",
            )) && onRenameChannel && (
              <TouchableOpacity
                onPress={() => {
                  const channel = selectedChannelForMenu;
                  setSelectedChannelForMenu(null);
                  if (channel) {
                    onRenameChannel(channel);
                  }
                }}
                className="flex-row items-center gap-4 py-4 border-b border-slate-100/80"
              >
                <Feather name="edit-2" size={18} color="#475569" />
                <Text className="text-slate-700 text-base font-semibold">
                  Đổi tên kênh
                </Text>
              </TouchableOpacity>
            )}

            {/* Rời khỏi kênh */}
            {selectedChannelForMenu?.isPrivate &&
              !isOwner &&
              !(room.channels?.findIndex((c) => c._id === selectedChannelForMenu?._id) === 0 || selectedChannelForMenu?.name === "General") &&
              selectedChannelForMenu?.members?.some((m) => m.userId === currentUserId) &&
              onLeaveChannel && (
                <TouchableOpacity
                  onPress={() => {
                    const channel = selectedChannelForMenu;
                    setSelectedChannelForMenu(null);
                    if (channel) {
                      onLeaveChannel(channel);
                    }
                  }}
                  className="flex-row items-center gap-4 py-4 border-b border-slate-100/80"
                >
                  <Feather name="log-out" size={18} color="#EF4444" />
                  <Text className="text-red-500 text-base font-semibold">
                    Rời khỏi kênh
                  </Text>
                </TouchableOpacity>
              )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
