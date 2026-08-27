import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useAddChannelMutation } from "../../lib/redux/features/rooms/roomsApi";
import { toast } from "../../lib/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoomMemberResponse } from "@tobomeet/shared/types";

interface CreateChannelModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomMembers: RoomMemberResponse[];
  currentUserId: string;
}

export default function CreateChannelModal({
  visible,
  onClose,
  roomId,
  roomMembers,
  currentUserId,
}: CreateChannelModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [addChannel, { isLoading }] = useAddChannelMutation();

  const [channelName, setChannelName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setChannelName("");
      setIsPrivate(false);
      setSelectedMemberIds([]);
      setMemberSearchQuery("");
      setError(null);
    }
  }, [visible]);

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    setError(null);

    if (!channelName.trim()) {
      setError(t("room.error_channel_name_required", { defaultValue: "Vui lòng nhập tên kênh" }));
      return;
    }

    try {
      const formattedName = channelName.trim().toLowerCase().replace(/\s+/g, "-");
      await addChannel({
        roomId,
        name: formattedName,
        isPrivate,
        initialMemberIds: isPrivate ? selectedMemberIds : [],
      }).unwrap();

      toast.success(t("room.channel_created_success", { defaultValue: "Tạo kênh thành công" }));
      onClose();
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      const rawMsg = errorObj?.data?.message || errorObj?.message;
      setError(rawMsg || "Tạo kênh thất bại");
    }
  };

  const eligibleMembers = roomMembers?.filter((m) => m.userId !== currentUserId) || [];

  const filteredMembers = eligibleMembers.filter((m) => {
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.trim().toLowerCase();
    const nameMatch = m.displayName?.toLowerCase().includes(q);
    const emailMatch = m.email?.toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!isLoading) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className="flex-1 justify-center items-center bg-black/45 px-4"
          style={{
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (!isLoading) onClose();
            }}
            className="absolute inset-0"
          />

          <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl min-h-[350px] max-h-[90%] flex-col">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <Text className="text-lg font-bold text-slate-900">
                {t("room.create_channel_title", { defaultValue: "Tạo kênh mới" })}
              </Text>
              <TouchableOpacity
                disabled={isLoading}
                onPress={onClose}
                className="p-1.5 rounded-xl bg-slate-100"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {/* Tên Kênh */}
            <View className="mb-5">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                {t("room.channel_name", { defaultValue: "Tên kênh" })} *
              </Text>
              <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <TextInput
                  value={channelName}
                  onChangeText={setChannelName}
                  placeholder={t("room.channel_name_placeholder", { defaultValue: "Tên kênh..." })}
                  placeholderTextColor="#94A3B8"
                  maxLength={30}
                  className="flex-1 text-base text-slate-800 py-0.5"
                />
              </View>
            </View>

            {/* Quyền riêng tư */}
            <View className="mb-5">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                {t("room.channel_privacy", { defaultValue: "Quyền riêng tư của kênh" })}
              </Text>
              <View className="flex-row gap-3">
                {/* Công khai */}
                <TouchableOpacity
                  onPress={() => setIsPrivate(false)}
                  className={`flex-1 p-4 rounded-2xl border flex-col ${
                    !isPrivate
                      ? "border-[#2563EB] bg-[#F0F5FF]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    {/* Radio Circle */}
                    <View className={`w-4 h-4 rounded-full border justify-center items-center ${!isPrivate ? "border-[#2563EB]" : "border-slate-300"}`}>
                      {!isPrivate && <View className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />}
                    </View>
                    <Feather name="globe" size={16} color={!isPrivate ? "#2563EB" : "#64748B"} />
                    <Text className={`text-sm font-bold ${!isPrivate ? "text-[#1E3A8A]" : "text-slate-700"}`}>
                      {t("room.channel_public", { defaultValue: "Công khai" })}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-400 leading-normal">
                    {t("room.channel_public_desc", { defaultValue: "Tất cả thành viên trong phòng đều có quyền xem" })}
                  </Text>
                </TouchableOpacity>

                {/* Riêng tư */}
                <TouchableOpacity
                  onPress={() => setIsPrivate(true)}
                  className={`flex-1 p-4 rounded-2xl border flex-col ${
                    isPrivate
                      ? "border-[#2563EB] bg-[#F0F5FF]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    {/* Radio Circle */}
                    <View className={`w-4 h-4 rounded-full border justify-center items-center ${isPrivate ? "border-[#2563EB]" : "border-slate-300"}`}>
                      {isPrivate && <View className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />}
                    </View>
                    <Feather name="lock" size={16} color={isPrivate ? "#D97706" : "#64748B"} />
                    <Text className={`text-sm font-bold ${isPrivate ? "text-[#1E3A8A]" : "text-slate-700"}`}>
                      {t("room.channel_private", { defaultValue: "Riêng tư" })}
                    </Text>
                  </View>
                  <Text className="text-[11px] text-slate-400 leading-normal">
                    {t("room.channel_private_desc", { defaultValue: "Chỉ các thành viên được chỉ định mới truy cập được" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Chọn thành viên cho Kênh Riêng tư */}
            {isPrivate && (
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {t("room.channel_select_members", { defaultValue: "Thành viên được cấp quyền" })} ({selectedMemberIds.length})
                </Text>

                {/* Danh sách chip đã chọn */}
                {selectedMemberIds.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5 p-2 bg-amber-50/60 rounded-xl border border-amber-200/50 max-h-24 mb-3">
                    {selectedMemberIds.map((id) => {
                      const member = eligibleMembers.find((m) => m.userId === id);
                      const name = member?.displayName || member?.email || id;
                      return (
                        <View
                          key={id}
                          className="flex-row items-center gap-1 px-2 py-1 rounded-lg bg-white border border-amber-200 shadow-sm"
                        >
                          {member?.avatarUrl ? (
                            <Image
                              source={{ uri: member.avatarUrl }}
                              className="w-4 h-4 rounded-full"
                            />
                          ) : (
                            <View className="w-4 h-4 rounded-full bg-amber-500 justify-center items-center">
                              <Text className="text-[8px] font-bold text-white uppercase">
                                {name.charAt(0)}
                              </Text>
                            </View>
                          )}
                          <Text className="text-[10px] font-bold text-amber-900 max-w-[100px]" numberOfLines={1}>
                            {name}
                          </Text>
                          <TouchableOpacity onPress={() => handleToggleMember(id)}>
                            <Feather name="x" size={10} color="#D97706" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Tìm kiếm */}
                <View className="bg-slate-50 border border-slate-200 rounded-xl flex-row items-center px-3 py-1.5 mb-2">
                  <Feather name="search" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <TextInput
                    value={memberSearchQuery}
                    onChangeText={setMemberSearchQuery}
                    placeholder={t("room.search_member_placeholder", { defaultValue: "Nhập email hoặc tên..." })}
                    placeholderTextColor="#94A3B8"
                    className="flex-1 text-xs text-slate-900 py-1"
                  />
                  {memberSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setMemberSearchQuery("")}>
                      <Feather name="x-circle" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Danh sách thành viên */}
                <View className="bg-slate-50/50 border border-slate-200 rounded-2xl p-2 max-h-48">
                  {eligibleMembers.length === 0 ? (
                    <Text className="text-xs text-slate-400 italic p-3 text-center">
                      {t("room.no_other_members", { defaultValue: "Không có thành viên khác trong phòng" })}
                    </Text>
                  ) : filteredMembers.length === 0 ? (
                    <Text className="text-xs text-slate-400 italic p-3 text-center">
                      {t("room.no_member_found", { defaultValue: "Không tìm thấy kết quả phù hợp" })}
                    </Text>
                  ) : (
                    <ScrollView nestedScrollEnabled className="max-h-[160px]">
                      {filteredMembers.map((m) => {
                        const isSelected = selectedMemberIds.includes(m.userId);
                        return (
                          <TouchableOpacity
                            key={m.userId}
                            onPress={() => handleToggleMember(m.userId)}
                            className={`flex-row items-center justify-between p-2.5 rounded-xl mb-1 ${
                              isSelected ? "bg-amber-100/70" : "active:bg-slate-100"
                            }`}
                          >
                            <View className="flex-row items-center gap-2.5 flex-1">
                              {m.avatarUrl ? (
                                <Image
                                  source={{ uri: m.avatarUrl }}
                                  className="w-7 h-7 rounded-full"
                                />
                              ) : (
                                <View className="w-7 h-7 rounded-full bg-blue-500 justify-center items-center">
                                  <Text className="text-[10px] font-bold text-white uppercase">
                                    {(m.displayName || m.email || "U").charAt(0)}
                                  </Text>
                                </View>
                              )}
                              <View className="flex-1">
                                <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                                  {m.displayName || t("room.member", { defaultValue: "Thành viên" })}
                                </Text>
                                {m.email && (
                                  <Text className="text-[9px] text-slate-400" numberOfLines={1}>
                                    {m.email}
                                  </Text>
                                )}
                              </View>
                            </View>
                            {isSelected && <Feather name="check" size={14} color="#D97706" />}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </View>
            )}

            {error && (
              <View className="bg-red-50 border border-red-100 rounded-xl p-3 flex-row items-center gap-2 mb-4">
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text className="text-red-600 text-xs flex-1">{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer buttons */}
          <View className="flex-row gap-3 mt-4 border-t border-slate-100 pt-4 w-full">
            <TouchableOpacity
              disabled={isLoading}
              onPress={onClose}
              className="flex-1 py-3.5 bg-[#F1F5F9] rounded-xl justify-center items-center active:bg-slate-200"
            >
              <Text className="text-sm font-bold text-slate-700">
                {t("room.cancel", { defaultValue: "Hủy" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!channelName.trim() || isLoading}
              className={`flex-1 py-3.5 rounded-xl justify-center items-center flex-row gap-2 active:opacity-95 ${
                !channelName.trim() || isLoading ? "bg-blue-300" : "bg-[#0052FF]"
              }`}
            >
              {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
              <Text className="text-white font-bold text-sm">
                {t("room.create_channel", { defaultValue: "Tạo kênh" })}
              </Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
