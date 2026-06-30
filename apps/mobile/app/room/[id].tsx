import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useGetRoomByIdQuery, useAddChannelMutation } from "../../lib/redux/features/rooms/roomsApi";
import { useGetMeQuery } from "../../lib/redux/features/users/usersApi";
import { Feather } from "@expo/vector-icons";

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: room, isLoading, error, refetch } = useGetRoomByIdQuery(id);
  const { data: profile } = useGetMeQuery();
  const [addChannel, { isLoading: isAddingChannel }] = useAddChannelMutation();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelError, setChannelError] = useState<string | null>(null);

  const isOwner = room && profile && room.ownerId === profile.supabaseId;

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !room) return;
    setChannelError(null);

    try {
      await addChannel({
        roomId: room._id,
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
      }).unwrap();
      setNewChannelName("");
      setShowAddChannelModal(false);
      refetch();
    } catch (err: any) {
      setChannelError(err?.message || "Không thể tạo kênh. Vui lòng thử lại.");
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  if (error || !room) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 p-6">
        <Feather name="alert-triangle" size={48} color="#EF4444" />
        <Text className="text-slate-800 font-bold text-base mt-4">
          {t("room.room_not_found")}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/home")}
          className="mt-6 bg-[#0052FF] px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold text-sm">
            {t("room.back_to_dashboard")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50 pt-12"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.replace("/home")}>
            <Feather name="arrow-left" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View className="w-8 h-8 rounded-lg bg-blue-50 justify-center items-center">
            <Feather
              name={room.type === "classroom" ? "book-open" : "video"}
              size={16}
              color={room.type === "classroom" ? "#4F46E5" : "#0052FF"}
            />
          </View>
          <Text className="font-bold text-slate-800 text-base truncate max-w-[180px]">
            {room.name}
          </Text>
        </View>

        {/* Add Channel Button */}
        {isOwner && (
          <TouchableOpacity
            onPress={() => setShowAddChannelModal(true)}
            className="w-9 h-9 rounded-lg bg-slate-100 justify-center items-center"
          >
            <Feather name="plus" size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Layout */}
      <View className="flex-1 flex-row">
        {/* Channels List (Left Sidebar Style) */}
        <View className="w-[120px] bg-slate-50 border-r border-slate-100 py-4">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 mb-3">
            {t("room.channels")}
          </Text>
          <FlatList
            data={room.channels}
            keyExtractor={(item) => item._id || item.name}
            renderItem={({ item }) => {
              const isActive = activeChannelId === item._id;
              return (
                <TouchableOpacity
                  onPress={() => setActiveChannelId(item._id || null)}
                  className={`flex-row items-center px-4 py-3 relative ${
                    isActive ? "bg-white" : ""
                  }`}
                >
                  {isActive && (
                    <View className="absolute left-0 w-1 h-5 bg-[#0052FF] rounded-r-full" />
                  )}
                  <Feather
                    name="hash"
                    size={14}
                    color={isActive ? "#0052FF" : "#94A3B8"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-[#0052FF]" : "text-slate-600"
                    }`}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Content Area */}
        <View className="flex-1 bg-white justify-center items-center p-6">
          {activeChannelId ? (
            // Active Channel View Placeholder
            <View className="items-center justify-center gap-2">
              <Feather name="message-square" size={36} color="#CBD5E1" />
              <Text className="text-slate-800 font-bold text-sm">
                # {room.channels.find((c) => c._id === activeChannelId)?.name}
              </Text>
              <Text className="text-xs text-slate-400">
                Kênh hội thoại trực tuyến
              </Text>
            </View>
          ) : (
            // Empty State
            <View className="items-center justify-center gap-3">
              <View className="w-16 h-16 rounded-2xl bg-slate-100 justify-center items-center">
                <Text className="text-2xl font-bold text-slate-400">
                  {room.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="font-bold text-slate-700 text-sm">{room.name}</Text>
              <Text className="text-xs text-slate-400 text-center leading-relaxed">
                {t("room.select_channel_to_start")}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Create Channel Modal */}
      <Modal
        visible={showAddChannelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddChannelModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/40 px-4">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowAddChannelModal(false)}
            className="absolute inset-0"
          />

          <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl border border-slate-100">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-lg font-bold text-slate-900">
                {t("room.create_channel")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddChannelModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View className="mb-5">
              <Text className="text-xs text-slate-400 font-semibold mb-2 uppercase">
                {t("room.channel_name")}
              </Text>
              <View className="relative flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Text className="text-slate-400 text-sm mr-2">#</Text>
                <TextInput
                  value={newChannelName}
                  onChangeText={setNewChannelName}
                  placeholder={t("room.channel_name_placeholder")}
                  autoFocus
                  className="flex-1 text-sm text-slate-900 py-1"
                />
              </View>

              {channelError && (
                <View className="flex-row items-center gap-2 mt-3">
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text className="text-red-600 text-xs flex-1">{channelError}</Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => setShowAddChannelModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 justify-center items-center"
              >
                <Text className="text-sm font-medium text-slate-600">
                  {t("room.cancel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateChannel}
                disabled={!newChannelName.trim() || isAddingChannel}
                className={`px-5 py-3 rounded-xl justify-center items-center flex-row gap-2 ${
                  !newChannelName.trim() || isAddingChannel ? "bg-blue-300" : "bg-[#0052FF]"
                }`}
              >
                {isAddingChannel && <ActivityIndicator size="small" color="#ffffff" />}
                <Text className="text-white font-bold text-sm">
                  {t("room.create_channel")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
