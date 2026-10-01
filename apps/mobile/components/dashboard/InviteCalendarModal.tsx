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
  StyleSheet,
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

  // Theo dõi bàn phím — tránh padding "dính" của KeyboardAvoidingView (tương tự MobileChatModal)
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
  // top dạng pixel tránh lỗi tính percentage sai reference frame
  const panelTop = screenHeight * 0.12;

  // padding bottom: khi bàn phím mở thêm 16px giãn cách, khi đóng thêm insets.bottom + 20
  const bottomPad =
    keyboardHeight > 0 ? Math.max(insets.bottom + 16, 16) : Math.max(insets.bottom + 20, 32);

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
        t("calendar.alert_invite_success")
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert(
        i18n.language === "vi" ? "Lỗi" : "Error",
        err?.data?.message || err?.message || t("calendar.alert_invite_error")
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
      <View style={styles.overlay}>
        {/* Backdrop chạm vào để dismiss bàn phím hoặc đóng modal */}
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFillObject}
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              onClose();
            }
          }}
        />

        <View
          style={[
            styles.container,
            {
              top: panelTop,          // pixel value, ~12% từ trên
              bottom: keyboardHeight, // đáy panel luôn sát bàn phím
              paddingBottom: bottomPad,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="user-plus" size={20} color="#0052FF" />
              <Text style={styles.headerTitle}>
                {t("calendar.invite_modal_title")}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Feather name="search" size={18} color="#94A3B8" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("calendar.search_users_placeholder")}
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
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
            <View style={styles.selectedSection}>
              <Text style={styles.selectedCountText}>
                {t("calendar.selected")} ({selectedUsers.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {selectedUsers.map((u) => (
                  <View
                    key={u.supabaseId || (u as any)._id || u.email}
                    style={styles.userChip}
                  >
                    <Text style={styles.userChipText} numberOfLines={1}>
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
            style={styles.userList}
            contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {users.length === 0 && !isSearching && searchQuery.trim().length > 0 && (
              <View style={styles.emptyContainer}>
                <Feather name="user-x" size={32} color="#CBD5E1" />
                <Text style={styles.emptyText}>
                  {t("calendar.no_users_found")}
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
                  style={[
                    styles.userRow,
                    alreadyIn && styles.userRowDisabled,
                    selected && styles.userRowSelected,
                  ]}
                >
                  <View style={styles.userInfoLeft}>
                    {usr.avatarUrl ? (
                      <Image
                        source={{ uri: usr.avatarUrl }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>
                          {(usr.displayName || usr.email)
                            .substring(0, 1)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.nameContainer}>
                      <Text
                        style={[
                          styles.userName,
                          alreadyIn && { color: "#94A3B8" },
                        ]}
                        numberOfLines={1}
                      >
                        {usr.displayName || usr.email}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {usr.email}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.userStatusRight}>
                    {alreadyIn ? (
                      <View style={styles.alreadyBadge}>
                        <Text style={styles.alreadyBadgeText}>
                          {t("calendar.already_in_event")}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.checkCircle,
                          selected && styles.checkCircleSelected,
                        ]}
                      >
                        {selected && (
                          <Feather name="check" size={14} color="#FFFFFF" />
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
                style={styles.loadMoreBtn}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color="#0052FF" />
                ) : (
                  <Text style={styles.loadMoreText}>
                    {t("room.load_more", { defaultValue: "Tải thêm" })}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isInviting}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>{t("calendar.cancel")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendInvites}
              disabled={selectedUsers.length === 0 || isInviting}
              style={[
                styles.sendBtn,
                (selectedUsers.length === 0 || isInviting) && styles.sendBtnDisabled,
              ]}
            >
              {isInviting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.sendBtnText}>
                    {t("calendar.send_invites")}
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    // top và bottom được set từ inline style để phản ứng với keyboard
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#0F172A",
  },
  closeBtn: {
    padding: 4,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    height: "100%",
  },
  selectedSection: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  selectedCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  userChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 6,
    maxWidth: 180,
  },
  userChipText: {
    fontSize: 12,
    color: "#1D4ED8",
    fontWeight: "600",
  },
  userList: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  userRowSelected: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFC",
  },
  userRowDisabled: {
    opacity: 0.6,
    backgroundColor: "#F8FAFC",
  },
  userInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
  },
  nameContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  userEmail: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
  userStatusRight: {
    justifyContent: "center",
    alignItems: "center",
  },
  alreadyBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alreadyBadgeText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  checkCircleSelected: {
    backgroundColor: "#0052FF",
    borderColor: "#0052FF",
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0052FF",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  sendBtn: {
    flex: 1.5,
    backgroundColor: "#0052FF",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0052FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
