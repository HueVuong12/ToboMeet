import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
  Dimensions,
  type KeyboardEvent,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalUserSearch } from "../../hooks/useGlobalUserSearch";
import { useInviteCalendarMembersMutation } from "../../lib/redux/api/calendarApi";
import { UserResponse } from "@tobomeet/shared/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  existingMemberIds?: string[];
  existingEmails?: string[];
  onSuccess?: () => void;
}

export default function InviteCalendarModal({
  visible,
  onClose,
  eventId,
  existingMemberIds = [],
  existingEmails = [],
  onSuccess,
}: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserResponse[]>([]);

  const [inviteCalendarMembers, { isLoading: isInviting }] =
    useInviteCalendarMembersMutation();

  const {
    users = [],
    isSearching,
    isLoadingMore,
    hasNext,
    loadMore,
  } = useGlobalUserSearch({
    q: searchQuery,
    skip: !visible,
    debounceMs: 300,
  });

  useEffect(() => {
    if (visible) {
      setSearchQuery("");
      setSelectedUsers([]);
    }
  }, [visible]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) setKeyboardHeight(0);
  }, [visible]);

  const { height: screenHeight } = Dimensions.get("window");
  const panelTop = screenHeight * 0.12;
  const bottomPad =
    keyboardHeight > 0
      ? Math.max(insets.bottom + 16, 16)
      : Math.max(insets.bottom + 20, 32);

  const normalizedExistingIds = new Set(
    existingMemberIds.filter(Boolean).map((id) => String(id))
  );
  const normalizedExistingEmails = new Set(
    existingEmails.filter(Boolean).map((e) => e.toLowerCase())
  );

  const isUserAlreadyInEvent = (user: UserResponse) => {
    const sId = user.supabaseId;
    const uId = (user as any)._id || (user as any).id;
    const email = user.email?.toLowerCase();

    if (sId && normalizedExistingIds.has(String(sId))) return true;
    if (uId && normalizedExistingIds.has(String(uId))) return true;
    if (email && normalizedExistingEmails.has(email)) return true;
    return false;
  };

  const isUserSelected = (user: UserResponse) => {
    return selectedUsers.some(
      (sel) =>
        (sel.supabaseId && sel.supabaseId === user.supabaseId) ||
        ((sel as any)._id && (sel as any)._id === (user as any)._id) ||
        ((sel as any).id && (sel as any).id === (user as any).id) ||
        sel.email.toLowerCase() === user.email.toLowerCase()
    );
  };

  const handleToggleUser = (user: UserResponse) => {
    if (isUserAlreadyInEvent(user)) return;

    if (isUserSelected(user)) {
      setSelectedUsers(
        selectedUsers.filter(
          (sel) =>
            sel.supabaseId !== user.supabaseId &&
            (sel as any)._id !== (user as any)._id &&
            (sel as any).id !== (user as any).id &&
            sel.email.toLowerCase() !== user.email.toLowerCase()
        )
      );
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveSelected = (user: UserResponse) => {
    setSelectedUsers(
      selectedUsers.filter(
        (sel) =>
          sel.supabaseId !== user.supabaseId &&
          (sel as any)._id !== (user as any)._id &&
          (sel as any).id !== (user as any).id &&
          sel.email.toLowerCase() !== user.email.toLowerCase()
      )
    );
  };

  const handleSendInvites = async () => {
    if (selectedUsers.length === 0 || !eventId) return;

    try {
      const userIds = selectedUsers
        .map((u) => u.supabaseId || (u as any)._id || (u as any).id)
        .filter(Boolean);

      const invitees = selectedUsers.map((u) => ({
        userId: u.supabaseId || (u as any)._id || (u as any).id,
        email: u.email,
        displayName: u.displayName || u.email,
      }));

      await inviteCalendarMembers({
        id: eventId,
        userIds,
        invitees,
      }).unwrap();

      Alert.alert(
        i18n.language === "vi" ? "Thành công" : "Success",
        t("calendar.alert_invite_success", { defaultValue: "Đã gửi lời mời thành công!" })
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        err?.data?.message ||
          err?.message ||
          t("calendar.alert_invite_error", { defaultValue: "Không thể gửi lời mời. Vui lòng thử lại!" })
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900/50">
        <TouchableOpacity
          activeOpacity={1}
          className="absolute inset-0"
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              onClose();
            }
          }}
        />

        <View
          style={{
            top: panelTop,
            bottom: keyboardHeight,
            paddingBottom: bottomPad,
          }}
          className="absolute left-0 right-0 bg-white rounded-t-3xl border-t border-slate-100"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
            <View className="flex-row items-center gap-2">
              <Feather name="user-plus" size={20} color="#0052FF" />
              <Text className="text-base font-bold text-slate-800">
                {t("calendar.invite_modal_title", { defaultValue: "Mời người tham gia" })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View className="px-5 pt-3 pb-2">
            <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-2 gap-2">
              <Feather name="search" size={18} color="#94A3B8" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("calendar.search_users_placeholder", {
                  defaultValue: "Tìm kiếm theo tên hoặc email...",
                })}
                placeholderTextColor="#94A3B8"
                className="flex-1 text-sm text-slate-800 py-0"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isSearching && (
                <ActivityIndicator size="small" color="#0052FF" />
              )}
            </View>
          </View>

          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <View className="px-5 py-2">
              <Text className="text-xs font-semibold text-slate-500 mb-1.5">
                {t("calendar.selected", { defaultValue: "Đã chọn" })} ({selectedUsers.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                {selectedUsers.map((u) => (
                  <View
                    key={u.supabaseId || (u as any)._id || u.email}
                    className="flex-row items-center bg-blue-50 border border-blue-200 py-1 px-2.5 rounded-full gap-1.5 max-w-[180px]"
                  >
                    <Text className="text-xs text-blue-700 font-semibold" numberOfLines={1}>
                      {u.displayName || u.email}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveSelected(u)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* User Results List */}
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {users.length === 0 && !isSearching && searchQuery.trim().length > 0 && (
              <View className="items-center justify-center py-10 gap-2.5">
                <Feather name="user-x" size={32} color="#CBD5E1" />
                <Text className="text-xs text-slate-400">
                  {t("calendar.no_users_found", { defaultValue: "Không tìm thấy người dùng phù hợp." })}
                </Text>
              </View>
            )}

            {users.map((usr) => {
              const alreadyIn = isUserAlreadyInEvent(usr);
              const selected = isUserSelected(usr);

              return (
                <TouchableOpacity
                  key={usr.supabaseId || (usr as any)._id || usr.email}
                  disabled={alreadyIn}
                  onPress={() => handleToggleUser(usr)}
                  className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 border ${
                    selected
                      ? "border-blue-300 bg-blue-50/50"
                      : alreadyIn
                      ? "border-slate-100 bg-slate-50 opacity-60"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                    {usr.avatarUrl ? (
                      <Image
                        source={{ uri: usr.avatarUrl }}
                        className="w-9 h-9 rounded-full border border-slate-200"
                      />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-slate-200 justify-center items-center">
                        <Text className="text-sm font-bold text-slate-600">
                          {(usr.displayName || usr.email)
                            .substring(0, 1)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${
                          alreadyIn ? "text-slate-400" : "text-slate-800"
                        }`}
                        numberOfLines={1}
                      >
                        {usr.displayName || usr.email}
                      </Text>
                      <Text className="text-xs text-slate-400 mt-0.5" numberOfLines={1}>
                        {usr.email}
                      </Text>
                    </View>
                  </View>

                  <View className="justify-center items-center">
                    {alreadyIn ? (
                      <View className="bg-slate-100 px-2 py-1 rounded-md">
                        <Text className="text-[10px] text-slate-500 font-semibold">
                          {t("calendar.already_in_event", { defaultValue: "Đã tham gia sự kiện" })}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className={`w-5 h-5 rounded-full border items-center justify-center ${
                          selected
                            ? "bg-blue-600 border-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selected && (
                          <Feather name="check" size={12} color="#FFFFFF" />
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            {hasNext && (
              <TouchableOpacity
                onPress={loadMore}
                disabled={isLoadingMore}
                className="py-3 items-center"
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color="#0052FF" />
                ) : (
                  <Text className="text-xs font-semibold text-blue-600">
                    {i18n.language === "vi" ? "Tải thêm" : "Load more"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View className="flex-row gap-3 px-5 pt-3.5 border-t border-slate-100">
            <TouchableOpacity
              onPress={onClose}
              disabled={isInviting}
              className="flex-1 py-3 rounded-xl border border-slate-200 items-center justify-center active:bg-slate-50"
            >
              <Text className="text-sm font-semibold text-slate-600">
                {t("calendar.cancel", { defaultValue: "Hủy" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendInvites}
              disabled={selectedUsers.length === 0 || isInviting}
              className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5 ${
                selectedUsers.length === 0 || isInviting
                  ? "bg-slate-300"
                  : "bg-blue-600 active:bg-blue-700"
              }`}
            >
              {isInviting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={15} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">
                    {t("calendar.send_invites", { defaultValue: "Gửi lời mời" })}
                    {selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ""}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
