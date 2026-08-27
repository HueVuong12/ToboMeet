import React from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMeetingInvite } from "../../hooks/useMeetingInvite";
import { Participant } from "livekit-client";
import { useTranslation } from "react-i18next";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
  displayParticipants: Participant[];
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  meetingCode,
  displayParticipants,
}: InviteMemberModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const {
    searchQuery,
    setSearchQuery,
    isLoading,
    isFetching,
    hasNextPage,
    availableMembersToInvite,
    invitingUserId,
    handleSendInvite,
    loadMore,
  } = useMeetingInvite({
    meetingCode,
    displayParticipants,
    isOpen,
  });

  const renderItem = ({ item }: { item: any }) => (
    <View className="flex-row items-center p-3 bg-[#222] rounded-xl border border-[#333] mb-2">
      <View className="relative shrink-0">
        {item.avatarUrl ? (
          <Image
            source={{ uri: item.avatarUrl }}
            className="w-10 h-10 rounded-full border border-[#444] bg-[#333]"
          />
        ) : (
          <View className="w-10 h-10 rounded-full bg-slate-700 items-center justify-center border border-[#444]">
            <Text className="text-slate-300 font-bold uppercase text-sm">
              {item.displayName?.charAt(0) || "?"}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 ml-3 justify-center">
        <View className="flex-row items-center gap-2">
          <Text
            className="text-[14px] font-medium text-slate-200"
            numberOfLines={1}
          >
            {item.displayName ||
              t("meeting.invite_member_modal.default_user_name")}
          </Text>
          {item.isOutsider && (
            <View className="px-1.5 py-0.5 bg-blue-500/20 rounded border border-blue-500/30">
              <Text className="text-[9px] font-bold text-blue-400 uppercase">
                {t("meeting.invite_member_modal.outsider_badge")}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-[11px] text-slate-500 mt-0.5" numberOfLines={1}>
          {item.email}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => handleSendInvite(item.userId, item.displayName)}
        disabled={invitingUserId === item.userId}
        className="px-4 py-2 bg-[#333] rounded-lg border border-[#444] min-w-[70px] items-center justify-center"
      >
        {invitingUserId === item.userId ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : (
          <Text className="text-blue-400 font-semibold text-xs">
            {t("meeting.invite_member_modal.invite_button")}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View
        style={{
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
        }}
        className="flex-1 bg-black/80 justify-center px-4"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="absolute inset-0"
        />

        <View
          className="bg-[#1c1c1c] rounded-2xl border border-[#333] w-full flex-col overflow-hidden"
          style={{ maxHeight: 520 }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-[#333]">
            <View className="flex-row items-center gap-2">
              <Feather name="user-plus" size={18} color="#3b82f6" />
              <Text className="text-[15px] font-bold text-white ml-2">
                {t("meeting.invite_member_modal.title")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1.5">
              <Feather name="x" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="p-4 bg-[#111]">
            <View className="flex-row items-center bg-[#222] border border-[#333] rounded-xl px-3 h-11">
              <Feather name="search" size={18} color="#64748b" />
              {/* Đã sửa: Thêm p-0 và style includeFontPadding để căn giữa chữ tuyệt đối */}
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t(
                  "meeting.invite_member_modal.search_placeholder",
                )}
                placeholderTextColor="#64748b"
                className="flex-1 ml-2.5 text-white text-[15px] p-0"
                style={{
                  includeFontPadding: false,
                  textAlignVertical: "center",
                }}
                autoFocus
              />
            </View>
          </View>

          {/* Khu vực danh sách */}
          <View style={{ flexShrink: 1, maxHeight: 380 }} className="bg-[#1c1c1c] relative">
            {isLoading ? (
              <View className="py-10 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : availableMembersToInvite.length > 0 ? (
              <FlatList
                data={availableMembersToInvite}
                keyExtractor={(item) => item.userId}
                renderItem={renderItem}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ padding: 12 }}
                onEndReached={() => {
                  if (hasNextPage && !isFetching) loadMore();
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  hasNextPage && isFetching ? (
                    <View className="py-4 items-center">
                      <ActivityIndicator size="small" color="#3b82f6" />
                    </View>
                  ) : null
                }
              />
            ) : (
              <View className="py-10 justify-center items-center opacity-70 px-4">
                <Feather name="user-minus" size={36} color="#475569" />
                <Text className="text-slate-400 text-sm mt-3 text-center">
                  {searchQuery
                    ? t("meeting.invite_member_modal.no_search_results")
                    : t("meeting.invite_member_modal.all_members_present")}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
