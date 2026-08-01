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
  useAddMemberByEmailOrIdMutation,
  useLeaveRoomMutation,
  useDisbandRoomMutation,
  useGetRoomMembersQuery,
  useRemoveMemberMutation,
} from "../../lib/redux/features/rooms/roomsApi";
import {
  useGetMeQuery,
  useSearchUsersQuery,
} from "../../lib/redux/features/users/usersApi";
import { Feather } from "@expo/vector-icons";
import { socket } from "../../lib/socket";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../lib/redux/store";
import PreviewModal from "../../components/meeting/PreviewModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoomUpdateListener } from "../../hooks/socket/useRoomUpdateListener";
import { useMeetingDeviceStatus } from "../../hooks/useMeetingDeviceStatus";
import { useMeetingLauncher } from "../../hooks/useMeetingLauncher";
import { meetingsApi } from "../../lib/redux/features/meetings/meetingsApi";
import {
  useGetPostsQuery,
  PostDto,
} from "../../lib/redux/features/newsFeed/newsFeedApi";
import PostItem from "../../components/newsFeed/PostItem";
import CreatePostModal from "../../components/newsFeed/CreatePostModal";
import ReportUserModal from "../../components/room/ReportUserModal";
import ReportRoomModal from "../../components/room/ReportRoomModal";
import CreateChannelModal from "../../components/room/CreateChannelModal";
import AddPrivateChannelMemberModal from "../../components/room/AddPrivateChannelMemberModal";
import { ChannelResponse, RoomMemberResponse } from "@tobomeet/shared/types";
import RoomRightDrawer from "../../components/room/RoomRightDrawer";
import RoomLeftDrawer from "../../components/room/RoomLeftDrawer";
import MemberActionMenuModal from "../../components/room/MemberActionMenuModal";
import { useRoomPermissions } from "../../hooks/useRoomPermissions";

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
  const { data: membersList, refetch: refetchMembers } = useGetRoomMembersQuery(
    room?._id || "",
    { skip: !room?._id, refetchOnMountOrArgChange: true },
  );

  const [addMember] = useAddMemberByEmailOrIdMutation();
  const [leaveRoom] = useLeaveRoomMutation();
  const [disbandRoom] = useDisbandRoomMutation();
  const [removeMemberMutation] = useRemoveMemberMutation();
  const [channelToManage, setChannelToManage] =
    useState<ChannelResponse | null>(null);
  const [
    showAddPrivateChannelMemberModal,
    setShowAddPrivateChannelMemberModal,
  ] = useState(false);

  // Member options menu & Report user state
  const [selectedMemberForMenu, setSelectedMemberForMenu] =
    useState<RoomMemberResponse | null>(null);
  const [selectedMemberForReport, setSelectedMemberForReport] =
    useState<RoomMemberResponse | null>(null);
  const [showReportUserModal, setShowReportUserModal] = useState(false);

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);

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
  const [showReportRoomModal, setShowReportRoomModal] = useState(false);

  // News Feed state
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<PostDto | null>(null);

  const {
    data: posts = [],
    isLoading: isLoadingPosts,
    refetch: refetchPosts,
  } = useGetPostsQuery(
    { roomId: id || "", channelId: activeChannelId || "" },
    { skip: !id || !activeChannelId },
  );

  const insets = useSafeAreaInsets();

  const {
    currentChannel,
    isOwner,
    isCurrentUserRoomVice,
    canUserManageChannel,
    isTargetAdmin,
    isTargetRoomVice,
    isTargetRoomLeader,
  } = useRoomPermissions(
    room,
    membersList,
    profile?.supabaseId,
    activeChannelId,
    selectedMemberForMenu?.userId,
  );

  // Lấy trạng thái hiển thị UI (Nháy xanh nút họp, hiện thông báo đang trong phòng...)
  const { isJoinedOnThisDevice, activeMeeting } = useMeetingDeviceStatus(
    id,
    activeChannelId,
  );

  // Lấy hàm xử lý hành động khi user ấn nút "Tham gia"
  const { handleJoinMeeting, isJoining } = useMeetingLauncher({
    roomId: id,
    activeChannelId,
    displayName: profile?.displayName,
  });

  // Lắng nghe bất kì sự kiện nào trong room, đã refractor thành hook
  useRoomUpdateListener(id, profile?.supabaseId);

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
        meetingsApi.util.updateQueryData(
          "getActiveMeeting",
          { roomId: id, channelId: activeChannelId },
          (draft) => {
            draft.isOngoing = data.isOngoing;
            draft.meetingCode = data.meetingCode;
          },
        ),
      );
    };

    const handleNewsFeedUpdated = () => {
      refetchPosts();
    };

    socket.on("meeting_status_changed", handleStatusChanged);
    socket.on("post_created", handleNewsFeedUpdated);
    socket.on("post_updated", handleNewsFeedUpdated);
    socket.on("post_deleted", handleNewsFeedUpdated);
    socket.on("post_reaction_updated", handleNewsFeedUpdated);
    socket.on("comment_created", handleNewsFeedUpdated);
    socket.on("comment_updated", handleNewsFeedUpdated);
    socket.on("comment_deleted", handleNewsFeedUpdated);
    socket.on("comment_reaction_updated", handleNewsFeedUpdated);

    return () => {
      socket.emit("leave_channel", activeChannelId);
      socket.off("connect", joinChannel);
      socket.off("meeting_status_changed", handleStatusChanged);
      socket.off("post_created", handleNewsFeedUpdated);
      socket.off("post_updated", handleNewsFeedUpdated);
      socket.off("post_deleted", handleNewsFeedUpdated);
      socket.off("post_reaction_updated", handleNewsFeedUpdated);
      socket.off("comment_created", handleNewsFeedUpdated);
      socket.off("comment_updated", handleNewsFeedUpdated);
      socket.off("comment_deleted", handleNewsFeedUpdated);
      socket.off("comment_reaction_updated", handleNewsFeedUpdated);
    };
  }, [activeChannelId, id, dispatch]);

  // Set default active channel once room loads
  useEffect(() => {
    if (room && room.channels && room.channels.length > 0 && !activeChannelId) {
      setActiveChannelId(room.channels[0]._id || null);
    }
  }, [room]);

  // Navigation Guard: Nếu kênh hiện tại không nằm trong danh sách được phép truy cập (VD: bị xóa khỏi Kênh riêng tư)
  useEffect(() => {
    if (room?.channels && room.channels.length > 0 && activeChannelId) {
      const channelExists = room.channels.some(
        (c) => c._id === activeChannelId,
      );
      if (!channelExists) {
        setActiveChannelId(room.channels[0]._id || null);
      }
    }
  }, [room?.channels, activeChannelId]);

  const handleCopyLink = () => {
    if (!room) return;
    const WEB_URL =
      process.env.EXPO_PUBLIC_WEB_URL ||
      "https://dolphin-paternity-estrogen.ngrok-free.dev";
    const shareLink = `${WEB_URL}/room/join?code=${room.code}`;
    Clipboard.setString(shareLink);
    Alert.alert(t("room.link_copied"), t("room.link_copied_desc"));
  };

  const handleAddMember = async (targetUser: {
    supabaseId: string;
    displayName?: string;
  }) => {
    if (!room) return;

    // 1. Kiểm tra trùng lặp tại client để hiển thị phản hồi ngay lập tức (chỉ tính thành viên đang active)
    const isAlreadyMember = room.members?.some(
      (m: { userId: string; isLeft?: boolean; status?: string }) =>
        m.userId === targetUser.supabaseId &&
        m.isLeft !== true &&
        m.status !== "REMOVED" &&
        m.status !== "LEFT",
    );
    if (isAlreadyMember) {
      Alert.alert(t("room.notice"), t("room.already_member"));
      return;
    }

    try {
      await addMember({
        roomId: room._id,
        targetUserId: targetUser.supabaseId,
      }).unwrap();
      Alert.alert(
        t("room.success"),
        t("room.member_added_success", {
          name: targetUser.displayName || t("room.member"),
        }),
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
        t("room.add_member_error");
      Alert.alert(t("room.error"), errMsg);
    }
  };

  const handleKickMember = (member: {
    userId: string;
    displayName?: string;
  }) => {
    Alert.alert(
      t("room.confirm_remove_member_title"),
      t("room.confirm_remove_member_message", {
        name: member.displayName || t("room.member"),
      }),
      [
        { text: t("room.cancel"), style: "cancel" },
        {
          text: t("room.remove_member"),
          style: "destructive",
          onPress: async () => {
            if (!room) return;
            try {
              await removeMemberMutation({
                roomId: room._id,
                userId: member.userId,
              }).unwrap();
              setSelectedMemberForMenu(null);
              Alert.alert(
                t("room.success"),
                t("room.member_removed_success", {
                  name: member.displayName || t("room.member"),
                }),
              );
              refetchMembers();
              refetch();
            } catch (err) {
              console.log("Kick member error:", err);
              Alert.alert(t("room.error"), t("room.report_error_failed"));
            }
          },
        },
      ],
    );
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

  const activeChannel = currentChannel;

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
                  {t("room.ongoing")}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowPreviewModal(true)}
                disabled={isJoining}
                className="bg-amber-500 px-5 py-2.5 rounded-xl flex-row items-center gap-2 active:opacity-90"
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="video" size={16} color="#ffffff" />
                )}
                <Text className="text-white font-bold text-sm">
                  {t("room.join")}
                </Text>
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
              <Text className="text-white font-bold text-sm">
                {t("room.start_meeting")}
              </Text>
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

      {/* Main News Feed / Posts View */}
      <View className="flex-1 bg-slate-50 relative">
        {isLoadingPosts ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#0052FF" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* System Welcome Message - Chỉ hiển thị khi chưa có bài viết nào */}
            {posts.length === 0 && (
              <View className="bg-white border border-slate-100 rounded-2xl p-4 mb-4 flex-row items-start gap-3 shadow-sm">
                <View className="w-10 h-10 rounded-full bg-blue-50 justify-center items-center">
                  <Feather name="info" size={18} color="#0052FF" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-slate-800 text-base">
                      {t("room.system")}
                    </Text>
                    <Text className="text-xs text-slate-400">
                      {t("news_feed.just_now")}
                    </Text>
                  </View>
                  <Text className="text-sm text-slate-600 mt-1 leading-relaxed">
                    {t("room.welcome_channel_desc", {
                      channel: activeChannel ? activeChannel.name : "General",
                      room: room.name,
                    })}
                  </Text>
                </View>
              </View>
            )}

            {/* Nút Thông báo mới (Đặt trên đầu Bảng tin giống Web) */}
            <View className="mb-4 flex-row justify-start">
              <TouchableOpacity
                onPress={() => {
                  setEditingPost(null);
                  setShowCreatePostModal(true);
                }}
                className="flex-row items-center gap-2 h-[42px] px-5 bg-[#0052FF] active:bg-blue-700 rounded-full shadow-sm"
              >
                <Feather name="edit-3" size={16} color="#ffffff" />
                <Text className="text-white font-bold text-sm">
                  {t("news_feed.new_post_button")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Posts List */}
            {posts.map((post) => (
              <PostItem
                key={post._id}
                post={post}
                currentUserId={profile?.supabaseId}
                onEditPost={(p) => {
                  setEditingPost(p);
                  setShowCreatePostModal(true);
                }}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Create / Edit Post Modal */}
      {id && activeChannelId && (
        <CreatePostModal
          visible={showCreatePostModal}
          roomId={id}
          channelId={activeChannelId}
          editPost={editingPost}
          onClose={() => {
            setShowCreatePostModal(false);
            setEditingPost(null);
          }}
        />
      )}

      {/* LEFT DRAWER (Channels Sidebar Overlay) */}
      <RoomLeftDrawer
        visible={showLeftDrawer}
        onClose={() => setShowLeftDrawer(false)}
        room={room}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        isOwner={isOwner}
        currentUserId={profile?.supabaseId}
        onAddChannel={() => setShowAddChannelModal(true)}
        onManagePrivateChannel={(channel) => {
          setChannelToManage(channel);
          setShowAddPrivateChannelMemberModal(true);
        }}
        onOpenGroupActions={() => setShowGroupActionsModal(true)}
        onCopyLink={handleCopyLink}
        onGoBack={() => router.replace("/dashboard")}
      />

      {/* RIGHT DRAWER (Room Info & Members Sidebar Overlay) */}
      <RoomRightDrawer
        visible={showRightDrawer}
        onClose={() => setShowRightDrawer(false)}
        room={room}
        membersList={membersList || []}
        currentChannel={currentChannel}
        currentUserId={profile?.supabaseId}
        onSelectMember={(member) => setSelectedMemberForMenu(member)}
      />

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
                {t("room.room_actions")}
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
                {t("room.add_member")}
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
                {t("room.copy_link")}
              </Text>
            </TouchableOpacity>

            {/* Nút: Báo cáo phòng (Chỉ hiển thị cho thành viên không phải Trưởng phòng) */}
            {!isOwner && (
              <TouchableOpacity
                onPress={() => {
                  setShowGroupActionsModal(false);
                  setShowReportRoomModal(true);
                }}
                className="flex-row items-center gap-4 py-3.5 border-b border-slate-100/50"
              >
                <Feather name="flag" size={18} color="#D97706" />
                <Text className="text-amber-600 text-base font-semibold">
                  {t("room.report_room", { defaultValue: "Báo cáo phòng" })}
                </Text>
              </TouchableOpacity>
            )}

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
                    t("room.confirm_title"),
                    t("room.confirm_leave"),
                    [
                      { text: t("room.cancel"), style: "cancel" },
                      {
                        text: t("room.leave_room"),
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
                {t("room.leave_room")}
              </Text>
            </TouchableOpacity>

            {/* Nút: Giải tán phòng (Chỉ Owner mới thấy) */}
            {isOwner && (
              <TouchableOpacity
                onPress={() => {
                  setShowGroupActionsModal(false);
                  Alert.alert(
                    t("room.confirm_disband_title"),
                    t("room.confirm_disband"),
                    [
                      { text: t("room.cancel"), style: "cancel" },
                      {
                        text: t("room.disband_room"),
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
                  {t("room.disband_room")}
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
                {t("room.add_member")}
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
                placeholder={t("room.search_member_placeholder")}
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
                    {t("room.user_not_found")}
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
                {t("room.select_successor")}
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
                {t("room.handover_warning")}
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
                        t("room.confirm_handover_title"),
                        t("room.confirm_handover_message", {
                          name: item.displayName,
                        }),
                        [
                          { text: t("room.cancel"), style: "cancel" },
                          {
                            text: t("room.handover_and_leave"),
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
      <CreateChannelModal
        visible={showAddChannelModal}
        onClose={() => setShowAddChannelModal(false)}
        roomId={room._id}
        roomMembers={membersList || []}
        currentUserId={profile?.supabaseId || ""}
      />

      {/* Add Private Channel Member Modal */}
      <AddPrivateChannelMemberModal
        visible={showAddPrivateChannelMemberModal}
        onClose={() => {
          setShowAddPrivateChannelMemberModal(false);
          setChannelToManage(null);
        }}
        roomId={room._id}
        channel={channelToManage}
      />

      {/* Modal Thao tác Thành viên (Báo xấu, Xóa khỏi phòng) */}
      <MemberActionMenuModal
        visible={!!selectedMemberForMenu}
        onClose={() => setSelectedMemberForMenu(null)}
        member={selectedMemberForMenu}
        room={room}
        currentChannel={currentChannel}
        currentUserId={profile?.supabaseId}
        isOwner={isOwner}
        canUserManageChannel={canUserManageChannel}
        isCurrentUserRoomVice={isCurrentUserRoomVice}
        isTargetAdmin={isTargetAdmin}
        isTargetRoomVice={isTargetRoomVice}
        isTargetRoomLeader={isTargetRoomLeader}
        onReportUser={(m) => {
          setSelectedMemberForReport({
            userId: m.userId,
            displayName: m.displayName || "User",
          } as RoomMemberResponse);
          setShowReportUserModal(true);
        }}
        onKickMember={(m) => handleKickMember(m)}
        refetchMembers={refetchMembers}
        refetchRoom={refetch}
      />

      {/* Modal Báo xấu Người dùng */}
      {selectedMemberForReport && (
        <ReportUserModal
          visible={showReportUserModal}
          onClose={() => {
            setShowReportUserModal(false);
            setSelectedMemberForReport(null);
          }}
          reportedUserId={selectedMemberForReport.userId}
          reportedUserName={selectedMemberForReport.displayName || "User"}
          roomId={room?._id}
          roomName={room?.name}
          roomCode={room?.code}
        />
      )}

      {/* Modal Báo cáo Phòng họp */}
      {room && (
        <ReportRoomModal
          visible={showReportRoomModal}
          onClose={() => setShowReportRoomModal(false)}
          roomId={room._id}
          roomName={room.name}
        />
      )}

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
