// components/meeting/JoinBreakoutModal.tsx
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useDeviceId } from "../../hooks/useDeviceId";
import { useGetBreakoutCountsQuery } from "../../lib/redux/features/meetings/meetingsApi";
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

  const { handleSwitchToBreakout } = useMeetingSessionContext();
  const { breakoutStartedAt } = useRoomSettings({ meetingCode });

  const [realTime, setRealTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState<number | null>(null);

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
    if (!isOpen || timeOffset === null) return;
    const interval = setInterval(() => {
      setRealTime(Date.now() + timeOffset);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeOffset]);

  if (!isOpen) return null;

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
          paddingBottom: Math.max(insets.bottom, 20),
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
            <View className="flex-row items-center gap-2">
              <View className="p-2 bg-[#222] rounded-lg border border-[#333]">
                <Feather name="grid" size={18} color="#60a5fa" />
              </View>
              <Text className="text-white text-base font-bold">
                {t("meeting.join_breakout_modal.modal_title", {
                  defaultValue: "Chọn nhóm thảo luận",
                })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1.5 rounded-lg bg-[#222]">
              <Feather name="x" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* BODY */}
          <ScrollView
            className="flex-1 p-5"
            contentContainerClassName="space-y-3.5 pb-6"
            showsVerticalScrollIndicator={false}
          >
            {rooms && rooms.length > 0 ? (
              rooms.map((room) => {
                const currentCount = roomCounts[room.id] || 0;
                const hasLimit = room.maxParticipants > 0;
                const isFull = hasLimit && currentCount >= room.maxParticipants;
                const isCurrentlyJoining = joiningRoomId === room.id;

                // Tính toán thời gian còn lại
                let isExpired = false;
                let timeDisplay = "";

                if (room.durationMinutes > 0 && breakoutStartedAt) {
                  if (timeOffset === null) {
                    timeDisplay = "--:--";
                  } else {
                    const endTime =
                      breakoutStartedAt + room.durationMinutes * 60 * 1000;
                    const remainingMs = endTime - realTime;

                    if (remainingMs <= 0) {
                      isExpired = true;
                      timeDisplay = t("meeting.join_breakout_modal.time_expired", {
                        defaultValue: "Hết giờ",
                      });
                    } else {
                      const totalSeconds = Math.floor(remainingMs / 1000);
                      const m = Math.floor(totalSeconds / 60);
                      const s = totalSeconds % 60;
                      timeDisplay = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
                    }
                  }
                } else if (room.durationMinutes > 0) {
                  timeDisplay = t("meeting.join_breakout_modal.duration_minutes", {
                    count: room.durationMinutes,
                    defaultValue: `${room.durationMinutes} phút`,
                  });
                }

                const isDisabled = isFull || isCurrentlyJoining || isExpired;

                return (
                  <View
                    key={room.id}
                    className="p-4 bg-[#1a1a1a] border border-[#333] rounded-2xl space-y-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-bold text-white text-base flex-1 mr-2" numberOfLines={1}>
                        {room.name}
                      </Text>

                      <View className="flex-row items-center gap-3 shrink-0">
                        {/* Số người */}
                        <View className="flex-row items-center gap-1 bg-[#222] px-2.5 py-1 rounded-lg border border-[#333]">
                          <Feather name="users" size={13} color="#94a3b8" />
                          <Text className="text-xs font-semibold text-slate-300">
                            {currentCount}{hasLimit ? ` / ${room.maxParticipants}` : ""}
                          </Text>
                        </View>

                        {/* Thời gian */}
                        {room.durationMinutes > 0 && (
                          <View className="flex-row items-center gap-1 bg-[#222] px-2.5 py-1 rounded-lg border border-[#333]">
                            <Feather name="clock" size={13} color={isExpired ? "#ef4444" : "#f59e0b"} />
                            <Text
                              className={`text-xs font-mono font-semibold ${
                                isExpired ? "text-red-400" : "text-amber-400"
                              }`}
                            >
                              {timeDisplay}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* NÚT THAM GIA */}
                    <TouchableOpacity
                      onPress={() => handleJoin(room.id)}
                      disabled={isDisabled}
                      className={`w-full py-3 rounded-xl flex-row items-center justify-center gap-2 active:opacity-90 ${
                        isDisabled
                          ? "bg-[#282828] border border-[#3a3a3a]"
                          : "bg-blue-600 shadow-md shadow-blue-900/30"
                      }`}
                    >
                      {isCurrentlyJoining ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Feather
                            name="log-in"
                            size={16}
                            color={isDisabled ? "#64748b" : "#ffffff"}
                          />
                          <Text
                            className={`font-bold text-sm ${
                              isDisabled ? "text-slate-500" : "text-white"
                            }`}
                          >
                            {isExpired
                              ? t("meeting.join_breakout_modal.room_closed", {
                                  defaultValue: "Phòng đã đóng",
                                })
                              : isFull
                                ? t("meeting.join_breakout_modal.room_full", {
                                    defaultValue: "Phòng đã đầy",
                                  })
                                : t("meeting.join_breakout_modal.join", {
                                    defaultValue: "Tham gia",
                                  })}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View className="items-center justify-center py-16 space-y-3">
                <View className="w-14 h-14 rounded-full bg-[#222] items-center justify-center border border-[#333]">
                  <Feather name="grid" size={24} color="#64748b" />
                </View>
                <Text className="text-slate-400 text-sm font-medium text-center">
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
