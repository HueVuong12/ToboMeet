// components/meeting/JoinBreakoutModal.tsx
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useParticipants } from "@livekit/react-native";
import { useDeviceId } from "../../hooks/useDeviceId";
import {
  useAssignUsersToBreakoutMutation,
  useGetBreakoutCountsQuery,
} from "../../lib/redux/features/meetings/meetingsApi";
import { useMeetingSessionContext } from "./contexts/MeetingSessionContext";
import { useRoomSettings } from "../../hooks/useRoomSettings";
import { toast } from "../../lib/toast";
import { LivekitBreakoutRoom } from "@tobomeet/shared/types";

interface JoinBreakoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: LivekitBreakoutRoom[];
  meetingCode: string;
}

export default function JoinBreakoutModal({
  isOpen,
  onClose,
  rooms,
  meetingCode,
}: JoinBreakoutModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const deviceId = useDeviceId();
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const { handleSwitchToBreakout } = useMeetingSessionContext();
  const { breakoutStartedAt, breakoutDuration, isHost, breakoutRoomsList } =
    useRoomSettings({
      meetingCode,
    });

  const [assignUsersApi] = useAssignUsersToBreakoutMutation();

  const [realTime, setRealTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState<number | null>(null);

  const activeRooms = rooms && rooms.length > 0 ? rooms : breakoutRoomsList;

  const { data } = useGetBreakoutCountsQuery(
    { code: meetingCode },
    {
      skip: !isOpen || !meetingCode,
      pollingInterval: 3000,
    },
  );

  const roomCounts = data?.counts || {};

  // Khi nhận được giờ từ Server, tính toán Độ lệch (Offset)
  useEffect(() => {
    if (data?.serverTime && timeOffset === null) {
      setTimeOffset(data.serverTime - Date.now());
    }
  }, [data?.serverTime, timeOffset]);

  // Chạy đếm ngược mượt mà mỗi 1 giây ở Local (áp dụng độ lệch)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRealTime(Date.now() + (timeOffset ?? 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeOffset]);

  // Reset expanded state khi đóng modal
  useEffect(() => {
    if (!isOpen) {
      setExpandedRoomId(null);
      setSearchQuery("");
      setAssigningUserId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const myIdentity = localParticipant?.identity;

  // Tính toán thời gian chung cho phiên Breakout (tất cả các phòng dùng chung thời gian)
  const durationMinutes =
    activeRooms?.[0]?.durationMinutes || breakoutDuration || 0;
  const startedAt = breakoutStartedAt || 0;

  let isExpired = false;
  let timeDisplay: string | null = null;

  if (durationMinutes > 0 && startedAt > 0) {
    if (timeOffset === null && !data?.serverTime) {
      timeDisplay = "--:--";
    } else {
      const endTime = startedAt + durationMinutes * 60 * 1000;
      const remainingMs = endTime - realTime;

      if (remainingMs <= 0) {
        isExpired = true;
        timeDisplay = t("meeting.join_breakout_modal.time_expired", {
          defaultValue: "Đã hết giờ",
        });
      } else {
        const totalSeconds = Math.floor(remainingMs / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        timeDisplay = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      }
    }
  }

  const handleJoin = async (breakoutRoomId: string) => {
    if (!deviceId) {
      toast.error(
        t("meeting.join_breakout_modal.device_not_found", {
          defaultValue: "Không tìm thấy thiết bị, vui lòng thử lại.",
        }),
      );
      return;
    }

    try {
      setJoiningRoomId(breakoutRoomId);
      await handleSwitchToBreakout(breakoutRoomId);
      onClose();
    } catch (error) {
      toast.error(
        t("meeting.join_breakout_modal.join_error", {
          defaultValue: "Không thể tham gia phòng thảo luận lúc này.",
        }),
      );
      console.error(error);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleAddUser = async (roomId: string, userId: string) => {
    try {
      setAssigningUserId(userId);
      await assignUsersApi({
        code: meetingCode,
        breakoutRoomId: roomId,
        userIds: [userId],
      }).unwrap();
      toast.success(
        t("meeting.join_breakout_modal.add_user_success", {
          defaultValue: "Đã thêm thành công",
        }),
      );
    } catch (error) {
      console.error("Lỗi khi thêm người dùng vào phòng:", error);
      toast.error(
        t("meeting.join_breakout_modal.add_user_error", {
          defaultValue: "Không thể thêm người dùng vào phòng.",
        }),
      );
    } finally {
      setAssigningUserId(null);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end bg-black/60"
        style={{
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 10),
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="flex-1"
        />

        <View className="bg-[#111] h-[75%] rounded-t-3xl border-t border-[#333] flex-col overflow-hidden">
          {/* DRAG HANDLE */}
          <View className="w-10 h-1 bg-[#444] rounded-full self-center mt-3 mb-2" />

          {/* HEADER */}
          <View className="px-5 py-3.5 border-b border-[#222] flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/30 mr-2.5">
                <Feather name="grid" size={18} color="#60a5fa" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-white text-base font-bold"
                  numberOfLines={1}
                >
                  {t("meeting.join_breakout_modal.modal_title", {
                    defaultValue: "Chọn nhóm thảo luận",
                  })}
                </Text>
                {activeRooms && activeRooms.length > 0 && (
                  <Text className="text-[11px] text-gray-400 font-medium mt-0.5">
                    {t("meeting.join_breakout_modal.rooms_count", {
                      count: activeRooms.length,
                      defaultValue: `${activeRooms.length} phòng`,
                    })}
                  </Text>
                )}
              </View>
            </View>

            <View className="flex-row items-center">
              {/* THỜI GIAN ĐẾM NGƯỢC DUY NHẤT Ở HEADER */}
              {durationMinutes > 0 && timeDisplay && (
                <View
                  className={`px-2.5 py-1 rounded-full border flex-row items-center mr-2 ${
                    isExpired
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-blue-500/10 border-blue-500/30"
                  }`}
                >
                  <Feather
                    name="clock"
                    size={12}
                    color={isExpired ? "#f87171" : "#60a5fa"}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    className={`font-mono text-xs font-semibold ${
                      isExpired ? "text-red-400" : "text-blue-300"
                    }`}
                  >
                    {timeDisplay}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={onClose}
                className="p-1.5 rounded-lg bg-[#222] border border-[#333]"
              >
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* BODY */}
          <ScrollView
            className="flex-1 p-3.5"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {activeRooms && activeRooms.length > 0 ? (
              activeRooms.map((room) => {
                const currentCount = roomCounts[room.id] || 0;
                const hasLimit = room.maxParticipants > 0;
                const isFull = hasLimit && currentCount >= room.maxParticipants;
                const isCurrentlyJoining = joiningRoomId === room.id;

                // Kiểm tra quyền vào phòng
                const assignedUsers = room.assignedUsers;
                const isAssignedMode = Array.isArray(assignedUsers);
                const isAssigned = isAssignedMode
                  ? myIdentity
                    ? assignedUsers.includes(myIdentity)
                    : false
                  : true;
                const canJoin = isHost || isAssigned;

                // Vô hiệu hoá nút nếu: Đầy phòng, đang join, hoặc đã HẾT GIỜ
                const isDisabled = isFull || isCurrentlyJoining || isExpired;
                const isExpanded = isAssignedMode && expandedRoomId === room.id;

                // Danh sách người tham gia phòng chính chưa được gán vào phòng này (loại bỏ Host / Admin)
                const eligibleParticipants = participants.filter((p) => {
                  let role = "guest";
                  try {
                    if (p.metadata) {
                      const meta = JSON.parse(p.metadata);
                      role = meta.role || "guest";
                    }
                  } catch (e) {}

                  // Loại bỏ Host / Admin khỏi danh sách có thể gán
                  if (
                    role === "owner" ||
                    role === "admin" ||
                    (p.isLocal && isHost)
                  ) {
                    return false;
                  }

                  const alreadyAssigned =
                    Array.isArray(room.assignedUsers) &&
                    room.assignedUsers.includes(p.identity);
                  if (alreadyAssigned) return false;

                  if (searchQuery.trim()) {
                    const name = p.name || p.identity || "";
                    return name
                      .toLowerCase()
                      .includes(searchQuery.trim().toLowerCase());
                  }
                  return true;
                });

                return (
                  <View
                    key={room.id}
                    className={`p-3.5 bg-[#222] border rounded-2xl mb-2.5 ${
                      isExpanded
                        ? "border-blue-500/50"
                        : "border-[#333]"
                    }`}
                  >
                    {/* HÀNG TRÊN: Tên phòng + Nút thao tác */}
                    <View className="flex-row items-center justify-between">
                      {/* CỘT TRÁI: Tên phòng + Badge chỉ định + Số người */}
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center flex-wrap mb-1">
                          <Text
                            className="font-bold text-gray-200 text-sm mr-2"
                            numberOfLines={1}
                          >
                            {room.name}
                          </Text>
                          {Array.isArray(room.assignedUsers) &&
                            room.assignedUsers.length > 0 &&
                            isAssigned && (
                              <View className="px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30">
                                <Text className="text-[10px] text-blue-400 font-medium">
                                  {t(
                                    "meeting.join_breakout_modal.assigned_only",
                                    {
                                      defaultValue: "Chỉ định sẵn",
                                    },
                                  )}
                                </Text>
                              </View>
                            )}
                        </View>

                        <View className="flex-row items-center">
                          <Feather
                            name="users"
                            size={12}
                            color="#94a3b8"
                            style={{ marginRight: 4 }}
                          />
                          <Text className="text-gray-400 text-xs">
                            {currentCount}
                            {hasLimit ? ` / ${room.maxParticipants}` : ""}
                          </Text>
                        </View>
                      </View>

                      {/* CỘT PHẢI: Nút Thêm người (Admin, chỉ khi phòng có assignedUsers) + Nút Tham gia */}
                      <View className="flex-row items-center shrink-0">
                        {isHost && isAssignedMode && (
                          <TouchableOpacity
                            onPress={() => {
                              setExpandedRoomId(isExpanded ? null : room.id);
                              setSearchQuery("");
                            }}
                            className={`p-2 rounded-xl border mr-2 ${
                              isExpanded
                                ? "bg-blue-600 border-blue-500"
                                : "bg-[#2a2a2a] border-[#3a3a3a]"
                            }`}
                          >
                            <Feather
                              name="user-plus"
                              size={14}
                              color={isExpanded ? "#ffffff" : "#94a3b8"}
                            />
                          </TouchableOpacity>
                        )}

                        {canJoin ? (
                          <TouchableOpacity
                            onPress={() => handleJoin(room.id)}
                            disabled={isDisabled}
                            className={`px-3.5 py-2 rounded-xl flex-row items-center active:opacity-90 ${
                              isDisabled
                                ? "bg-[#333] border border-[#444]"
                                : "bg-blue-600 active:bg-blue-500"
                            }`}
                          >
                            {isCurrentlyJoining ? (
                              <ActivityIndicator
                                size="small"
                                color="#ffffff"
                                style={{ marginRight: 4 }}
                              />
                            ) : (
                              <Feather
                                name="log-in"
                                size={14}
                                color={isDisabled ? "#6b7280" : "#ffffff"}
                                style={{ marginRight: 5 }}
                              />
                            )}
                            <Text
                              className={`font-bold text-xs ${
                                isDisabled ? "text-gray-500" : "text-white"
                              }`}
                            >
                              {isExpired
                                ? t("meeting.join_breakout_modal.room_closed", {
                                    defaultValue: "Đã đóng",
                                  })
                                : isFull
                                  ? t(
                                      "meeting.join_breakout_modal.room_full",
                                      {
                                        defaultValue: "Đã đầy",
                                      },
                                    )
                                  : t("meeting.join_breakout_modal.join", {
                                      defaultValue: "Tham gia",
                                    })}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View className="px-3 py-1.5 rounded-xl bg-[#1a1a1a] border border-[#333] flex-row items-center">
                            <Feather
                              name="lock"
                              size={12}
                              color="#94a3b8"
                              style={{ marginRight: 4 }}
                            />
                            <Text className="text-gray-400 text-xs font-medium">
                              {t("meeting.join_breakout_modal.assigned_only", {
                                defaultValue: "Chỉ định sẵn",
                              })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* SỔ XUỐNG DANH SÁCH THÊM NGƯỜI (INLINE) */}
                    {isHost && isExpanded && (
                      <View className="pt-3 mt-2.5 border-t border-[#333]">
                        {/* Ô tìm kiếm cục bộ */}
                        <View className="bg-[#181818] border border-[#3a3a3a] rounded-xl px-3 py-1.5 flex-row items-center mb-2.5">
                          <Feather
                            name="search"
                            size={14}
                            color="#94a3b8"
                            style={{ marginRight: 6 }}
                          />
                          <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={t(
                              "meeting.join_breakout_modal.search_participant",
                              {
                                defaultValue: "Tìm kiếm người tham gia...",
                              },
                            )}
                            placeholderTextColor="#6b7280"
                            className="flex-1 text-white text-xs py-0"
                          />
                          {searchQuery.length > 0 && (
                            <TouchableOpacity
                              onPress={() => setSearchQuery("")}
                            >
                              <Feather name="x" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Danh sách người có thể thêm */}
                        {eligibleParticipants.length > 0 ? (
                          <View className="gap-1.5">
                            {eligibleParticipants.map((p) => {
                              let avatarUrl = "";
                              try {
                                if (p.metadata) {
                                  const meta = JSON.parse(p.metadata);
                                  avatarUrl = meta.avatarUrl || "";
                                }
                              } catch (e) {}

                              const isAdding = assigningUserId === p.identity;

                              return (
                                <View
                                  key={p.identity}
                                  className="flex-row items-center justify-between p-2 bg-[#181818] border border-[#333] rounded-xl"
                                >
                                  <View className="flex-row items-center flex-1 mr-2">
                                    {avatarUrl ? (
                                      <Image
                                        source={{ uri: avatarUrl }}
                                        className="w-6 h-6 rounded-full mr-2"
                                      />
                                    ) : (
                                      <View className="w-6 h-6 rounded-full bg-blue-600/30 items-center justify-center mr-2">
                                        <Text className="text-blue-400 font-bold text-[10px]">
                                          {(p.name || p.identity || "U")
                                            .charAt(0)
                                            .toUpperCase()}
                                        </Text>
                                      </View>
                                    )}
                                    <Text
                                      className="text-gray-200 text-xs font-medium flex-1"
                                      numberOfLines={1}
                                    >
                                      {p.name || p.identity}
                                      {p.isLocal ? " (Bạn)" : ""}
                                    </Text>
                                  </View>

                                  <TouchableOpacity
                                    onPress={() =>
                                      handleAddUser(room.id, p.identity)
                                    }
                                    disabled={isAdding}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 flex-row items-center active:opacity-80"
                                  >
                                    {isAdding ? (
                                      <ActivityIndicator
                                        size="small"
                                        color="#ffffff"
                                        style={{ marginRight: 2 }}
                                      />
                                    ) : (
                                      <Feather
                                        name="plus"
                                        size={12}
                                        color="#ffffff"
                                        style={{ marginRight: 2 }}
                                      />
                                    )}
                                    <Text className="text-white text-[11px] font-semibold">
                                      {t("meeting.join_breakout_modal.add", {
                                        defaultValue: "Thêm",
                                      })}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>
                        ) : (
                          <View className="py-2.5 items-center justify-center">
                            <Text className="text-gray-500 text-xs text-center font-medium">
                              {t(
                                "meeting.join_breakout_modal.no_participants_to_add",
                                {
                                  defaultValue:
                                    "Không có người tham gia phù hợp",
                                },
                              )}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View className="items-center justify-center py-16">
                <View className="w-14 h-14 rounded-full bg-[#222] items-center justify-center border border-[#333] mb-3">
                  <Feather name="grid" size={24} color="#94a3b8" />
                </View>
                <Text className="text-gray-400 text-sm font-medium text-center">
                  {t("meeting.join_breakout_modal.no_rooms_created", {
                    defaultValue: "Chưa có nhóm thảo luận nào được tạo.",
                  })}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

