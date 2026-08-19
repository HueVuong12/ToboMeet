import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useAddChannelMemberMutation } from "../../lib/redux/features/rooms/roomsApi";
import { useChannelMemberSearch } from "../../hooks/useChannelMemberSearch";
import { toast } from "../../lib/toast";
import { UserResponse } from "@tobomeet/shared/types";


interface AddPrivateChannelMemberModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  channel: {
    _id?: string;
    id?: string;
    name: string;
    isPrivate?: boolean;
    members?: { userId: string; role: string; isLeft?: boolean; status?: string }[];
  } | null;
}

export default function AddPrivateChannelMemberModal({
  visible,
  onClose,
  roomId,
  channel,
}: AddPrivateChannelMemberModalProps) {
  const { t } = useTranslation();
  const [addChannelMember, { isLoading: isSubmitting }] = useAddChannelMemberMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { users: searchResults, isLoading: isSearching } = useChannelMemberSearch(
    searchQuery,
    !visible
  );

  const channelId = channel?._id || channel?.id || "";

  useEffect(() => {
    if (visible) {
      setSearchQuery("");
      setSelectedUser(null);
      setError(null);
    }
  }, [visible]);

  if (!visible || !channel) return null;

  const handleAdd = async () => {
    if (!selectedUser && !searchQuery.trim()) {
      setError(t("room.invite_error_empty", { defaultValue: "Vui lòng nhập email hoặc tên tài khoản" }));
      return;
    }

    setError(null);

    try {
      const targetId = selectedUser
        ? selectedUser.supabaseId || selectedUser._id
        : undefined;
      const queryStr = selectedUser
        ? selectedUser.email || selectedUser.displayName
        : searchQuery.trim();

      await addChannelMember({
        roomId,
        channelId,
        targetUserId: targetId,
        emailOrUsername: queryStr,
      }).unwrap();

      toast.success(t("room.toast_add_member_to_channel_success", { defaultValue: "Đã thêm thành viên vào kênh thành công." }));
      setSearchQuery("");
      setSelectedUser(null);
      onClose();
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      const rawMsg = errorObj?.data?.message || errorObj?.message;
      setError(rawMsg || t("room.invite_error_fallback", { defaultValue: "Không thể thêm thành viên vào kênh" }));
    }
  };

  const isUserAlreadyInChannel = (user: UserResponse) => {
    return channel.members?.some(
      (cm) =>
        cm.userId === (user.supabaseId || user._id) &&
        cm.isLeft !== true &&
        cm.status !== "REMOVED" &&
        cm.status !== "LEFT"
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <View className="flex-1 justify-center items-center bg-black/45 px-4">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (!isSubmitting) onClose();
          }}
          className="absolute inset-0"
        />

        <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 h-[380px] flex-col">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-bold text-slate-900">
              {t("room.add_member_to_channel_title", { defaultValue: "Thêm vào kênh riêng tư" })}
            </Text>
            <TouchableOpacity
              disabled={isSubmitting}
              onPress={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
            >
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View className="bg-slate-50 border border-slate-200 rounded-xl flex-row items-center px-3 py-1.5 mb-3">
            <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
            <TextInput
              value={
                selectedUser
                  ? `${selectedUser.displayName} (${selectedUser.email || "Facebook"})`
                  : searchQuery
              }
              onChangeText={(text) => {
                if (selectedUser) {
                  setSelectedUser(null);
                }
                setSearchQuery(text);
                setError(null);
              }}
              placeholder={t("room.search_member_placeholder", { defaultValue: "Nhập email hoặc tên..." })}
              placeholderTextColor="#94A3B8"
              className="flex-1 text-sm text-slate-900 py-1"
            />
            {(searchQuery.length > 0 || selectedUser) && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSelectedUser(null);
                  setError(null);
                }}
              >
                <Feather name="x-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Error message */}
          {error && (
            <View className="bg-red-50 border border-red-100 rounded-xl p-2.5 flex-row items-center gap-2 mb-2">
              <Feather name="alert-circle" size={12} color="#EF4444" />
              <Text className="text-red-600 text-[10px] flex-1">{error}</Text>
            </View>
          )}

          {/* Search Results */}
          <View className="flex-1">
            {isSearching ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="small" color="#0052FF" />
              </View>
            ) : selectedUser ? (
              <View className="flex-1 justify-center items-center p-4">
                <Text className="text-slate-500 text-sm text-center mb-4">
                  {t("room.confirm_add_selected_user", { defaultValue: "Bạn đang chọn thêm:" })}
                  {"\n"}
                  <Text className="font-bold text-slate-800">{selectedUser.displayName}</Text>
                </Text>

                <TouchableOpacity
                  onPress={handleAdd}
                  disabled={isSubmitting}
                  className="bg-[#0052FF] px-6 py-2.5 rounded-xl flex-row items-center gap-2"
                >
                  {isSubmitting && <ActivityIndicator size="small" color="#ffffff" />}
                  <Text className="text-white font-bold text-sm">
                    {t("room.add_action", { defaultValue: "Thêm thành viên" })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : searchResults && searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.supabaseId || item._id}
                renderItem={({ item }) => {
                  const alreadyInChannel = isUserAlreadyInChannel(item);
                  return (
                    <TouchableOpacity
                      disabled={alreadyInChannel}
                      onPress={() => {
                        setSelectedUser(item);
                        setError(null);
                      }}
                      className={`flex-row items-center gap-3 py-3 border-b border-slate-50 ${
                        alreadyInChannel ? "opacity-40" : "active:bg-slate-50"
                      }`}
                    >
                      <View className="w-10 h-10 rounded-full bg-blue-100 justify-center items-center overflow-hidden">
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} className="w-10 h-10" />
                        ) : (
                          <Text className="font-bold text-blue-600 text-sm">
                            {(item.displayName || item.email || "U").charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-slate-800">{item.displayName}</Text>
                        <Text className="text-xs text-slate-400 mt-0.5">{item.email}</Text>
                      </View>
                      {alreadyInChannel ? (
                        <Text className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded-md">
                          {t("room.already_in_channel", { defaultValue: "Đã ở trong kênh" })}
                        </Text>
                      ) : (
                        <Feather name="plus-circle" size={18} color="#0052FF" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            ) : searchQuery.trim() ? (
              <View className="flex-1 justify-center items-center py-8">
                <Feather name="users" size={32} color="#CBD5E1" />
                <Text className="text-slate-400 text-xs mt-2">
                  {t("room.user_not_found", { defaultValue: "Không tìm thấy người dùng" })}
                </Text>
              </View>
            ) : (
              <View className="flex-1 justify-center items-center py-8">
                <Feather name="search" size={32} color="#CBD5E1" />
                <Text className="text-slate-400 text-xs text-center mt-2 px-6">
                  {t("room.search_channel_invite_hint", { defaultValue: "Tìm kiếm bằng email hoặc tên tài khoản để thêm vào kênh riêng tư." })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
