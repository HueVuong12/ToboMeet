import React, { useState, useEffect } from "react";
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
  ScrollView,
  Image,
  Clipboard,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  useGetRoomByIdQuery,
  useAddChannelMutation,
  useAddMemberByEmailOrIdMutation,
  useLeaveRoomMutation,
  useDisbandRoomMutation,
  useGetRoomMembersQuery,
  roomsApi,
} from "../../lib/redux/features/rooms/roomsApi";
import {
  useGetMeQuery,
  useSearchUsersQuery,
} from "../../lib/redux/features/users/usersApi";
import { Feather } from "@expo/vector-icons";
import { socket } from "../../lib/socket";
import { useMeetingManager } from "../../hooks/useMeetingManager";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../lib/redux/store";
import PreviewModal from "../../components/meeting/PreviewModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RoomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const {
    data: room,
    isLoading,
    error,
    refetch,
  } = useGetRoomByIdQuery(id, { refetchOnMountOrArgChange: true });
  const { data: profile } = useGetMeQuery();
  const [addChannel, { isLoading: isAddingChannel }] = useAddChannelMutation();
  const { data: membersList, refetch: refetchMembers } = useGetRoomMembersQuery(
    room?._id || "",
    { skip: !room?._id, refetchOnMountOrArgChange: true },
  );

  const [addMember] = useAddMemberByEmailOrIdMutation();
  const [leaveRoom] = useLeaveRoomMutation();
  const [disbandRoom] = useDisbandRoomMutation();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelError, setChannelError] = useState<string | null>(null);

  // Search User state (Invite Member)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults, isFetching: isSearching } = useSearchUsersQuery(
    searchQuery,
    { skip: !searchQuery.trim() },
  );

  // Handover state (Leave Room as Owner)
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Drawer states
  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);
  const [showGroupActionsModal, setShowGroupActionsModal] = useState(false);
  const [messageText, setMessageText] = useState("");

  const isOwner = room && profile && room.ownerId === profile.supabaseId;
  const hasNavigatedAway = React.useRef(false);

  const insets = useSafeAreaInsets();

  const { handleJoinMeeting, isJoining, isJoinedOnThisDevice, activeMeeting } =
    useMeetingManager({
      roomId: id,
      activeChannelId: activeChannelId,
      userId: profile?.supabaseId,
      displayName: profile?.displayName,
    });

  // Lắng nghe sự kiện phòng họp của Kênh (Channel) hiện tại
  useEffect(() => {
    if (!activeChannelId || !id) return;

    // Join vào room socket của channel
    const joinChannel = () => {
      socket.emit("join_channel", activeChannelId);
    };

    if (socket.connected) {
      joinChannel();
    }

    // Đảm bảo join lại nếu mạng chập chờn
    socket.on("connect", joinChannel);

    const handleStatusChanged = (data: {
      isOngoing: boolean;
      meetingCode: string;
    }) => {
      // Cập nhật trực tiếp cache của RTK Query để UI đổi nút ngay lập tức
      dispatch(
        roomsApi.util.updateQueryData(
          "getActiveMeeting",
          { roomId: id, channelId: activeChannelId },
          (draft) => {
            draft.isOngoing = data.isOngoing;
            draft.meetingCode = data.meetingCode;
          },
        ),
      );
    };

    socket.on("meeting_status_changed", handleStatusChanged);

    return () => {
      socket.emit("leave_channel", activeChannelId);
      socket.off("connect", joinChannel);
      socket.off("meeting_status_changed", handleStatusChanged);
    };
  }, [activeChannelId, id, dispatch]);

  // Lắng nghe cập nhật phòng realtime trên Mobile
  useEffect(() => {
    if (!id) return;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join_room", id);

    const handleRoomUpdated = (data: {
      type: string;
      removedUserId?: string;
    }) => {
      console.log("[Socket Mobile] Room updated:", data);
      refetch();
      refetchMembers();

      if (hasNavigatedAway.current) return;

      // Chỉ xử lý cảnh báo và điều hướng cưỡng chế khi người dùng bị động rời phòng hoặc phòng bị giải tán
      const isKicked =
        data.type === "member_removed" &&
        data.removedUserId === profile?.supabaseId;
      const isRoomDisbanded = data.type === "room_disbanded";

      if (isKicked) {
        hasNavigatedAway.current = true;
        Alert.alert("Thông báo", "Bạn đã bị mời ra khỏi phòng.", [
          {
            text: "OK",
            onPress: () => router.replace("/dashboard"),
          },
        ]);
      } else if (isRoomDisbanded) {
        hasNavigatedAway.current = true;
        const msg =
          room?.ownerId === profile?.supabaseId
            ? "Đã giải tán phòng họp thành công."
            : "Phòng này đã bị giải tán bởi chủ phòng.";
        Alert.alert("Thông báo", msg, [
          {
            text: "OK",
            onPress: () => router.replace("/dashboard"),
          },
        ]);
      }
    };

    socket.on("room_updated", handleRoomUpdated);

    return () => {
      socket.emit("leave_room", id);
      socket.off("room_updated", handleRoomUpdated);
    };
  }, [id, profile?.supabaseId, room?.ownerId]);

  // Set default active channel once room loads
  useEffect(() => {
    if (room && room.channels && room.channels.length > 0 && !activeChannelId) {
      setActiveChannelId(room.channels[0]._id || null);
    }
  }, [room]);

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
    } catch (err) {
      const errorResponse = err as { message?: string };
      setChannelError(
        errorResponse.message || "Không thể tạo kênh. Vui lòng thử lại.",
      );
    }
  };

  const handleCopyLink = () => {
    if (!room) return;
    const WEB_URL =
      process.env.EXPO_PUBLIC_WEB_URL ||
      "https://dolphin-paternity-estrogen.ngrok-free.dev";
    const shareLink = `${WEB_URL}/room/join?code=${room.code}`;
    Clipboard.setString(shareLink);
    Alert.alert(
      "Đã sao chép liên kết",
      "Liên kết phòng họp đã được sao chép vào bộ nhớ tạm.",
    );
  };

  const handleAddMember = async (targetUser: {
    supabaseId: string;
    displayName?: string;
  }) => {
    if (!room) return;

    // 1. Kiểm tra trùng lặp tại client để hiển thị phản hồi ngay lập tức
    const isAlreadyMember = room.members?.some(
      (m: { userId: string }) => m.userId === targetUser.supabaseId,
    );
    if (isAlreadyMember) {
      Alert.alert("Thông báo", "Thành viên đã có trong phòng.");
      return;
    }

    try {
      await addMember({
        roomId: room._id,
        targetUserId: targetUser.supabaseId,
      }).unwrap();
      Alert.alert(
        "Thành công",
        `Đã thêm ${targetUser.displayName || "thành viên"} vào phòng.`,
      );
      setSearchQuery("");
      setShowInviteModal(false);
      refetchMembers();
      refetch();
    } catch (err) {
      const errorResponse = err as {
        message?: string;
        data?: { message?: string };
      };
      const errMsg =
        errorResponse.data?.message ||
        errorResponse.message ||
        "Không thể thêm thành viên. Vui lòng thử lại.";
      Alert.alert("Thông báo", errMsg);
    }
  };

  const handleLeaveRoom = async (newOwnerId?: string) => {
    if (!room) return;
    try {
      await leaveRoom({
        roomId: room._id,
        newOwnerId,
      }).unwrap();
      setShowHandoverModal(false);
      Alert.alert("Thông báo", "Bạn đã rời phòng thành công.");
      router.replace("/dashboard");
    } catch (err) {
      const errorResponse = err as {
        message?: string;
        data?: { message?: string };
      };
      Alert.alert(
        "Lỗi",
        errorResponse.data?.message ||
          errorResponse.message ||
          "Không thể rời phòng. Vui lòng thử lại.",
      );
    }
  };

  const handleDisbandRoom = async () => {
    if (!room) return;
    try {
      await disbandRoom(room._id).unwrap();
    } catch (err) {
      const errorResponse = err as {
        message?: string;
        data?: { message?: string };
      };
      Alert.alert(
        "Lỗi",
        errorResponse.data?.message ||
          errorResponse.message ||
          "Không thể giải tán phòng. Vui lòng thử lại.",
      );
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
          onPress={() => router.replace("/dashboard")}
          className="mt-6 bg-[#0052FF] px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-bold text-sm">
            {t("room.back_to_dashboard")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const activeChannel =
    room.channels?.find((c: { _id?: string }) => c._id === activeChannelId) ||
    room.channels?.[0];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50"
    >
      {/* Main Top Header */}
      <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-slate-100">
        {/* Left header group */}
        <View className="flex-row items-center gap-2">
          {/* Menu button to open Left Drawer */}
          <TouchableOpacity
            onPress={() => setShowLeftDrawer(true)}
            className="p-1"
          >
            <Feather name="menu" size={24} color="#1E293B" />
          </TouchableOpacity>

          {/* Room visual indicator square */}
          <View className="w-8 h-8 rounded-lg bg-blue-100 justify-center items-center">
            <Text className="font-bold text-blue-600 text-sm">
              {room.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Active channel name */}
          <Text className="font-bold text-slate-800 text-lg">
            {activeChannel ? activeChannel.name : "General"}
          </Text>
        </View>

        {/* Right header group */}
        <View className="flex-row items-center gap-2">
          {/* Cuộc họp Button */}
          {activeMeeting?.isOngoing ? (
            isJoinedOnThisDevice ? (
              <View className="bg-emerald-100 border border-emerald-300 px-4 py-2.5 rounded-xl flex-row items-center gap-2">
                <Feather name="video" size={16} color="#059669" />
                <Text className="text-emerald-700 font-bold text-sm">
                  Đang họp
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowPreviewModal(true)}
                disabled={isJoining}
                // className="bg-amber-500 px-5 py-2.5 rounded-xl flex-row items-center gap-2 active:opacity-90 shadow-sm"
                className="bg-amber-500 px-5 py-2.5 rounded-xl flex-row items-center gap-2 active:opacity-90"
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="video" size={16} color="#ffffff" />
                )}
                <Text className="text-white font-bold text-sm">Tham gia</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              onPress={() => setShowPreviewModal(true)}
              disabled={isJoining}
              className="bg-[#0052FF] px-5 py-2.5 rounded-xl flex-row items-center gap-2 active:opacity-90"
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="video" size={16} color="#ffffff" />
              )}
              <Text className="text-white font-bold text-sm">Bắt đầu họp</Text>
            </TouchableOpacity>
          )}

          {/* Info Button to open Right Drawer */}
          <TouchableOpacity
            onPress={() => setShowRightDrawer(true)}
            className="p-1"
          >
            <Feather name="info" size={22} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Chat/Conversation View */}
      <View className="flex-1 bg-white relative">
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* System Welcome Message */}
          <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4 flex-row items-start gap-3">
            <View className="w-10 h-10 rounded-full bg-slate-200 justify-center items-center">
              <Feather name="info" size={18} color="#64748B" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-slate-800 text-base">
                  Hệ thống
                </Text>
                <Text className="text-sm text-slate-400">Vừa xong</Text>
              </View>
              <Text className="text-base text-slate-600 mt-1 leading-relaxed">
                Chào mừng bạn đến với kênh{" "}
                <Text className="font-bold">
                  {activeChannel ? activeChannel.name : "General"}
                </Text>{" "}
                của phòng họp <Text className="font-bold">{room.name}</Text>.
                Hãy bắt đầu thảo luận!
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Message Input Bar */}
        <View className="p-4 border-t border-slate-100 bg-white">
          <View className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Bắt đầu bài viết mới..."
              placeholderTextColor="#94A3B8"
              multiline
              className="text-base text-slate-800 min-h-[40px] text-left"
              style={{ textAlignVertical: "top" }}
            />
            {/* Input Toolbar */}
            <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-200/50">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity className="p-1">
                  <Feather name="paperclip" size={18} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity className="p-1">
                  <Feather name="smile" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity className="w-9 h-9 rounded-full bg-[#0052FF] justify-center items-center active:opacity-90">
                <Feather
                  name="send"
                  size={16}
                  color="#ffffff"
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* LEFT DRAWER (Channels Sidebar Overlay) */}
      {showLeftDrawer && (
        <View className="absolute inset-0 z-50 flex-row">
          {/* Backdrop */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowLeftDrawer(false)}
            className="absolute inset-0 bg-black/30"
          />

          {/* Drawer Sheet */}
          <View className="w-[280px] bg-white h-full shadow-2xl flex-col">
            {/* Drawer Header */}
            <View className="px-5 py-4 border-b border-slate-100 flex-row justify-between items-center">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowLeftDrawer(false);
                    router.replace("/dashboard");
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
                  onPress={() => setShowGroupActionsModal(true)}
                  className="p-1.5 rounded-lg bg-slate-100"
                >
                  <Feather name="plus" size={16} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowLeftDrawer(false)}
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
                    Kênh
                  </Text>
                </TouchableOpacity>
                {isOwner && (
                  <TouchableOpacity
                    onPress={() => setShowAddChannelModal(true)}
                    className="p-1"
                  >
                    <Feather name="plus" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
              {isChannelsExpanded && (
                <ScrollView>
                  {room.channels?.map(
                    (item: { _id?: string; name: string }) => {
                      const isActive = activeChannelId === item._id;
                      return (
                        <TouchableOpacity
                          key={item._id || item.name}
                          onPress={() => {
                            setActiveChannelId(item._id || null);
                            setShowLeftDrawer(false);
                          }}
                          className={`flex-row items-center mx-3 my-1 px-3 py-2.5 rounded-xl ${
                            isActive ? "bg-blue-50/50" : ""
                          }`}
                        >
                          <Feather
                            name="hash"
                            size={16}
                            color={isActive ? "#0052FF" : "#94A3B8"}
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
                      );
                    },
                  )}
                </ScrollView>
              )}
            </View>

            {/* Drawer Footer - Room Code */}
            <View className="p-4 pb-8 border-t border-slate-100 bg-slate-50">
              <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                MÃ PHÒNG
              </Text>
              <View className="bg-white border border-slate-200 rounded-2xl p-2.5 flex-row items-center justify-between shadow-sm">
                <View className="flex-row items-center pl-2">
                  <Text className="text-slate-300 font-bold text-base mr-1">
                    #
                  </Text>
                  <Text className="text-slate-800 font-bold text-base">
                    {room.code}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCopyLink}
                  className="bg-slate-50/50 border border-slate-200/80 px-3 py-2 rounded-xl flex-row items-center gap-1 active:bg-slate-100"
                >
                  <Feather name="copy" size={14} color="#64748B" />
                  <Text className="text-xs text-[#64748B] font-bold">
                    Sao chép
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* RIGHT DRAWER (Room Info & Members Sidebar Overlay) */}
      {showRightDrawer && (
        <View className="absolute inset-0 z-50 flex-row justify-end">
          {/* Backdrop */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowRightDrawer(false)}
            className="absolute inset-0 bg-black/30"
          />

          {/* Drawer Sheet */}
          <View className="w-[280px] bg-white h-full shadow-2xl flex-col">
            {/* Drawer Header */}
            <View className="px-5 py-4 border-b border-slate-100 flex-row justify-between items-center">
              <Text className="font-bold text-slate-900 text-lg">
                Trong kênh này
              </Text>
              <TouchableOpacity
                onPress={() => setShowRightDrawer(false)}
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
                    MỌI NGƯỜI ({membersList?.length || 0})
                  </Text>
                  <TouchableOpacity>
                    <Text className="text-sm text-[#0052FF] font-bold">
                      Xem tất cả
                    </Text>
                  </TouchableOpacity>
                </View>

                {membersList?.map((m) => {
                  const memberIsOwner = m.role === "owner";
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
                          {m.userId === profile?.supabaseId && (
                            <Text className="text-slate-400 font-normal text-xs">
                              (Bạn)
                            </Text>
                          )}
                        </Text>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          {memberIsOwner ? (
                            <>
                              <Feather name="award" size={12} color="#D97706" />
                              <Text className="text-xs text-[#D97706] font-bold">
                                CHỦ PHÒNG
                              </Text>
                            </>
                          ) : (
                            <Text className="text-xs text-slate-400 font-medium">
                              Thành viên
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Description Section */}
              <View className="border-t border-slate-100 pt-5">
                <Text className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Mô tả phòng
                </Text>
                <Text className="text-base text-slate-500 leading-relaxed">
                  {room.description ||
                    "Không gian làm việc chung dành cho phòng " +
                      room.name +
                      "."}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Modal Menu Thao tác Nhóm */}
      <Modal
        visible={showGroupActionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGroupActionsModal(false)}
      >
        <View
          className="flex-1 justify-end bg-black/40"
          style={{
            paddingTop: Math.max(insets.top, 20), // Đẩy xuống khỏi tai thỏ/camera đục lỗ
            paddingBottom: Math.max(insets.bottom, 20), // Đẩy lên khỏi phím điều hướng
          }}
        >
          {/* Backdrop đóng menu */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowGroupActionsModal(false)}
            className="absolute inset-0"
          />

          <View className="bg-white rounded-t-3xl p-6 shadow-2xl">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
              <Text className="font-bold text-slate-800 text-lg mt-3">
                Thao tác phòng
              </Text>
            </View>

            {/* Nút: Thêm thành viên */}
            <TouchableOpacity
              onPress={() => {
                setShowGroupActionsModal(false);
                setShowInviteModal(true);
              }}
              className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
            >
              <Feather name="user-plus" size={18} color="#475569" />
              <Text className="text-slate-700 text-base font-semibold">
                Thêm thành viên
              </Text>
            </TouchableOpacity>

            {/* Nút: Sao chép phòng */}
            <TouchableOpacity
              onPress={() => {
                setShowGroupActionsModal(false);
                handleCopyLink();
              }}
              className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
            >
              <Feather name="copy" size={18} color="#475569" />
              <Text className="text-slate-700 text-base font-semibold">
                Sao chép liên kết
              </Text>
            </TouchableOpacity>

            {/* Nút: Rời phòng */}
            <TouchableOpacity
              onPress={() => {
                setShowGroupActionsModal(false);
                if (isOwner && membersList && membersList.length > 1) {
                  // Chủ phòng rời phòng và có các thành viên khác -> chuyển sang chọn bàn giao
                  setShowHandoverModal(true);
                } else {
                  // Thành viên thường hoặc phòng chỉ có 1 mình chủ phòng -> rời thẳng
                  Alert.alert(
                    "Xác nhận",
                    "Bạn có chắc chắn muốn rời phòng này?",
                    [
                      { text: "Hủy", style: "cancel" },
                      {
                        text: "Rời phòng",
                        style: "destructive",
                        onPress: () => handleLeaveRoom(),
                      },
                    ],
                  );
                }
              }}
              className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
            >
              <Feather name="log-out" size={18} color="#EF4444" />
              <Text className="text-red-500 text-base font-semibold">
                Rời phòng
              </Text>
            </TouchableOpacity>

            {/* Nút: Giải tán phòng (Chỉ Owner mới thấy) */}
            {isOwner && (
              <TouchableOpacity
                onPress={() => {
                  setShowGroupActionsModal(false);
                  Alert.alert(
                    "Giải tán phòng",
                    "Phòng họp sẽ bị giải tán hoàn toàn. Tất cả thành viên sẽ bị ngắt kết nối. Bạn có chắc chắn muốn giải tán phòng họp này?",
                    [
                      { text: "Hủy", style: "cancel" },
                      {
                        text: "Giải tán phòng",
                        style: "destructive",
                        onPress: handleDisbandRoom,
                      },
                    ],
                  );
                }}
                className="flex-row items-center gap-4 py-3.5"
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
                <Text className="text-red-500 text-base font-semibold">
                  Giải tán phòng
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Tìm kiếm & Thêm thành viên (Dạng Popup/Dialog ở giữa) */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/45 px-4">
          {/* Backdrop đóng menu */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowInviteModal(false)}
            className="absolute inset-0"
          />

          <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 h-[380px] flex-col">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-slate-900">
                Thêm thành viên
              </Text>
              <TouchableOpacity
                onPress={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="bg-slate-50 border border-slate-200 rounded-xl flex-row items-center px-3 py-1.5 mb-3">
              <Feather
                name="search"
                size={18}
                color="#94A3B8"
                style={{ marginRight: 6 }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm kiếm theo Tên hoặc Email..."
                placeholderTextColor="#94A3B8"
                className="flex-1 text-sm text-slate-900 py-1"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Feather name="x-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            <View className="flex-1 mt-2">
              {isSearching ? (
                <View className="flex-1 justify-center items-center">
                  <ActivityIndicator size="small" color="#0052FF" />
                </View>
              ) : searchResults && searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.supabaseId}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => handleAddMember(item)}
                      className="flex-row items-center gap-3 py-3 border-b border-slate-50 active:bg-slate-50"
                    >
                      <View className="w-10 h-10 rounded-full bg-blue-100 justify-center items-center overflow-hidden">
                        {item.avatarUrl ? (
                          <Image
                            source={{ uri: item.avatarUrl }}
                            className="w-10 h-10"
                          />
                        ) : (
                          <Text className="font-bold text-blue-600 text-sm">
                            {(item.displayName || item.email || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-bold text-slate-800">
                          {item.displayName}
                        </Text>
                        <Text className="text-xs text-slate-400 mt-0.5">
                          {item.email}
                        </Text>
                      </View>
                      <Feather name="plus-circle" size={18} color="#0052FF" />
                    </TouchableOpacity>
                  )}
                />
              ) : searchQuery.trim() ? (
                <View className="flex-1 justify-center items-center py-8">
                  <Feather name="users" size={32} color="#CBD5E1" />
                  <Text className="text-slate-400 text-xs mt-2">
                    Không tìm thấy người dùng
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Bàn giao quyền Chủ phòng (Dạng Popup/Dialog ở giữa) */}
      <Modal
        visible={showHandoverModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHandoverModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/45 px-4">
          {/* Backdrop đóng menu */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowHandoverModal(false)}
            className="absolute inset-0"
          />

          <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 h-[380px] flex-col">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-slate-900">
                Chọn người kế nhiệm
              </Text>
              <TouchableOpacity
                onPress={() => setShowHandoverModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Warning Box */}
            <View className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex-row items-start gap-2 mb-3">
              <Feather
                name="alert-triangle"
                size={16}
                color="#D97706"
                style={{ marginTop: 2 }}
              />
              <Text className="text-amber-800 text-xs flex-1 leading-relaxed">
                Bạn là Chủ phòng. Hãy bàn giao quyền chủ phòng cho một thành
                viên khác bên dưới trước khi rời đi.
              </Text>
            </View>

            {/* Members List for Handover */}
            <View className="flex-1">
              <FlatList
                data={
                  membersList?.filter(
                    (m) => m.userId !== profile?.supabaseId,
                  ) || []
                }
                keyExtractor={(item) => item.userId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Xác nhận bàn giao",
                        `Bàn giao quyền chủ phòng cho ${item.displayName} và rời phòng?`,
                        [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Bàn giao & Rời đi",
                            style: "destructive",
                            onPress: () => handleLeaveRoom(item.userId),
                          },
                        ],
                      );
                    }}
                    className="flex-row items-center gap-3 py-3 border-b border-slate-50 active:bg-slate-50"
                  >
                    <View className="w-10 h-10 rounded-full bg-blue-100 justify-center items-center overflow-hidden">
                      {item.avatarUrl ? (
                        <Image
                          source={{ uri: item.avatarUrl }}
                          className="w-10 h-10"
                        />
                      ) : (
                        <Text className="font-bold text-blue-600 text-sm">
                          {item.displayName?.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-slate-800">
                        {item.displayName}
                      </Text>
                      <Text className="text-xs text-slate-400 mt-0.5">
                        {item.email}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </View>
      </Modal>

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
                  <Text className="text-red-600 text-xs flex-1">
                    {channelError}
                  </Text>
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
                  !newChannelName.trim() || isAddingChannel
                    ? "bg-blue-300"
                    : "bg-[#0052FF]"
                }`}
              >
                {isAddingChannel && (
                  <ActivityIndicator size="small" color="#ffffff" />
                )}
                <Text className="text-white font-bold text-sm">
                  {t("room.create_channel")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        isJoining={isJoining}
        onJoin={(config) => {
          handleJoinMeeting(false, config);
        }}
      />
    </KeyboardAvoidingView>
  );
}
