// components/meeting/CreateBreakoutModal.tsx
import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useParticipantManager } from "../../hooks/useParticipantManager";
import { useStartBreakoutSessionMutation } from "../../lib/redux/features/meetings/meetingsApi";
import { CreateBreakoutRoomDto } from "@tobomeet/shared/types";
import { toast } from "../../lib/toast";

interface CreateBreakoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
}

export default function CreateBreakoutModal({
  isOpen,
  onClose,
  meetingCode,
}: CreateBreakoutModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { displayParticipants: participants } = useParticipantManager({
    meetingCode,
  });
  const [startBreakoutApi, { isLoading }] = useStartBreakoutSessionMutation();

  const [activeTab, setActiveTab] = useState<"auto" | "manual" | "self">(
    "auto",
  );

  // STATE CHẾ ĐỘ 1: TỰ ĐỘNG (AUTO)
  const [autoConfig, setAutoConfig] = useState({
    roomPrefix: t("meeting.create_breakout_modal.room_prefix", {
      defaultValue: "Nhóm",
    }),
    roomCount: 2,
    maxParticipants: 2,
    durationMinutes: 10,
  });
  const [isAutoAssign, setIsAutoAssign] = useState(true);

  // STATE CHẾ ĐỘ 2: THỦ CÔNG (MANUAL)
  const [manualRooms, setManualRooms] = useState(() => [
    {
      id: "room-1",
      name: `${t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} 1`,
      durationMinutes: 10,
    },
    {
      id: "room-2",
      name: `${t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} 2`,
      durationMinutes: 10,
    },
  ]);
  const [manualAssignments, setManualAssignments] = useState<
    Record<string, string>
  >({});

  // STATE MULTI-SELECT CHO MODAL THÊM THÀNH VIÊN VÀO PHÒNG
  const [selectingRoomId, setSelectingRoomId] = useState<string | null>(null);
  const [tempSelectedUsers, setTempSelectedUsers] = useState<string[]>([]);

  // STATE CHẾ ĐỘ 3: TỰ CHỌN (SELF)
  const [selfRooms, setSelfRooms] = useState(() => [
    {
      name: `${t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} 1`,
      maxParticipants: 2,
      durationMinutes: 10,
    },
    {
      name: `${t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} 2`,
      maxParticipants: 2,
      durationMinutes: 10,
    },
  ]);

  if (!isOpen) return null;

  // Mở modal thêm thành viên đa chọn cho 1 phòng
  const handleOpenAddMembersModal = (roomId: string) => {
    setSelectingRoomId(roomId);
    // Khởi tạo danh sách các thành viên hiện đang thuộc phòng này
    const currentMembersInRoom = Object.entries(manualAssignments)
      .filter(([_, rId]) => rId === roomId)
      .map(([userId]) => userId);
    setTempSelectedUsers(currentMembersInRoom);
  };

  // Toggle chọn / bỏ chọn thành viên trong modal
  const handleToggleMember = (userId: string) => {
    setTempSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  // Xác nhận lưu danh sách thành viên cho phòng
  const handleConfirmSelectedMembers = () => {
    if (!selectingRoomId) return;

    setManualAssignments((prev) => {
      const next = { ...prev };
      // Xóa gán cũ của phòng này
      Object.keys(next).forEach((uid) => {
        if (next[uid] === selectingRoomId) {
          delete next[uid];
        }
      });
      // Gán mới danh sách đã chọn
      tempSelectedUsers.forEach((uid) => {
        next[uid] = selectingRoomId;
      });
      return next;
    });

    setSelectingRoomId(null);
    setTempSelectedUsers([]);
  };

  const handleSubmit = async () => {
    let finalRoomsPayload: CreateBreakoutRoomDto[] = [];

    if (activeTab === "auto") {
      if (autoConfig.roomCount < 1) {
        toast.error(
          t("meeting.create_breakout_modal.error_min_room", {
            defaultValue: "Cần ít nhất 1 phòng",
          }),
        );
        return;
      }
      if (autoConfig.durationMinutes < 1) {
        toast.error(
          t("meeting.create_breakout_modal.error_min_duration", {
            defaultValue: "Thời gian tối thiểu 1 phút",
          }),
        );
        return;
      }

      const shuffled = [...participants].sort(() => 0.5 - Math.random());
      finalRoomsPayload = Array.from(
        { length: autoConfig.roomCount },
        (_, i) => ({
          name: `${autoConfig.roomPrefix.trim() || t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} ${i + 1}`,
          maxParticipants: autoConfig.maxParticipants,
          durationMinutes: autoConfig.durationMinutes,
          assignedUsers: [] as string[],
        }),
      );

      if (isAutoAssign) {
        shuffled.forEach((p, i) => {
          const roomIndex = Math.floor(i / autoConfig.maxParticipants);
          if (roomIndex < autoConfig.roomCount) {
            finalRoomsPayload[roomIndex].assignedUsers?.push(p.identity);
          }
        });
      }
    } else if (activeTab === "manual") {
      if (manualRooms.some((r) => r.name.trim() === "")) {
        toast.error(
          t("meeting.create_breakout_modal.error_room_name_empty", {
            defaultValue: "Tên phòng không được để trống",
          }),
        );
        return;
      }
      finalRoomsPayload = manualRooms.map((room) => ({
        name: room.name,
        maxParticipants: 2,
        durationMinutes: room.durationMinutes,
        assignedUsers: Object.entries(manualAssignments)
          .filter(([_, rId]) => rId === room.id)
          .map(([uId]) => uId),
      }));
    } else if (activeTab === "self") {
      if (selfRooms.some((r) => r.name.trim() === "")) {
        toast.error(
          t("meeting.create_breakout_modal.error_room_name_empty", {
            defaultValue: "Tên phòng không được để trống",
          }),
        );
        return;
      }
      if (selfRooms.some((r) => r.maxParticipants < 2)) {
        toast.error(
          t("meeting.create_breakout_modal.error_min_participants", {
            defaultValue: "Cần từ 2 người trở lên",
          }),
        );
        return;
      }
      if (selfRooms.some((r) => r.durationMinutes < 1)) {
        toast.error(
          t("meeting.create_breakout_modal.error_min_duration", {
            defaultValue: "Thời gian tối thiểu 1 phút",
          }),
        );
        return;
      }
      finalRoomsPayload = selfRooms;
    }

    try {
      await startBreakoutApi({
        code: meetingCode,
        rooms: finalRoomsPayload,
      }).unwrap();

      toast.success(
        t("meeting.create_breakout_modal.success_start", {
          defaultValue: "Đã mở các phòng thảo luận nhóm!",
        }),
      );
      onClose();
    } catch (error: any) {
      const msg =
        error?.data?.message ||
        error?.message ||
        t("meeting.create_breakout_modal.error_create_failed", {
          defaultValue: "Lỗi khi tạo phòng thảo luận.",
        });
      toast.error(msg);
    }
  };

  const selectedRoomForModal = manualRooms.find(
    (r) => r.id === selectingRoomId,
  );

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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

        <View className="bg-[#111] h-[88%] rounded-t-3xl border-t border-[#333] flex-col overflow-hidden">
          {/* DRAG HANDLE */}
          <View className="w-10 h-1 bg-[#444] rounded-full self-center mt-3 mb-3" />

          {/* HEADER */}
          <View className="px-5 py-4 border-b border-[#222] flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="p-2 bg-[#222] rounded-xl border border-[#333]">
                <Feather name="grid" size={18} color="#60a5fa" />
              </View>
              <Text className="text-white text-base font-bold">
                {t("meeting.create_breakout_modal.modal_title", {
                  defaultValue: "Chia nhóm thảo luận",
                })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-xl bg-[#222] active:bg-[#333]"
            >
              <Feather name="x" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* TAB NAVIGATION */}
          <View className="flex-row bg-[#1a1a1a] p-1.5 mx-5 my-4 rounded-xl border border-[#333]">
            <TouchableOpacity
              onPress={() => setActiveTab("auto")}
              className={`flex-1 py-2.5 rounded-lg items-center justify-center flex-row gap-1.5 ${activeTab === "auto" ? "bg-blue-600" : ""
                }`}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={activeTab === "auto" ? "#ffffff" : "#94a3b8"}
              />
              <Text
                className={`text-xs font-bold ${activeTab === "auto" ? "text-white" : "text-gray-400"
                  }`}
              >
                {t("meeting.create_breakout_modal.tab_auto", {
                  defaultValue: "Tự động",
                })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("manual")}
              className={`flex-1 py-2.5 rounded-lg items-center justify-center flex-row gap-1.5 ${activeTab === "manual" ? "bg-blue-600" : ""
                }`}
            >
              <Ionicons
                name="hand-left"
                size={14}
                color={activeTab === "manual" ? "#ffffff" : "#94a3b8"}
              />
              <Text
                className={`text-xs font-bold ${activeTab === "manual" ? "text-white" : "text-gray-400"
                  }`}
              >
                {t("meeting.create_breakout_modal.tab_manual", {
                  defaultValue: "Thủ công",
                })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("self")}
              className={`flex-1 py-2.5 rounded-lg items-center justify-center flex-row gap-1.5 ${activeTab === "self" ? "bg-blue-600" : ""
                }`}
            >
              <Ionicons
                name="options"
                size={14}
                color={activeTab === "self" ? "#ffffff" : "#94a3b8"}
              />
              <Text
                className={`text-xs font-bold ${activeTab === "self" ? "text-white" : "text-gray-400"
                  }`}
              >
                {t("meeting.create_breakout_modal.tab_self", {
                  defaultValue: "Tự chọn",
                })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB CONTENTS */}
          <ScrollView
            className="flex-1 px-5"
            contentContainerClassName="pb-10 pt-2"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ================= TAB 1: AUTO ================= */}
            {activeTab === "auto" && (
              <View>
                <Text className="text-slate-400 text-xs leading-5 mb-4">
                  {t("meeting.create_breakout_modal.auto_desc", {
                    count: participants.length,
                    defaultValue: `Hệ thống sẽ tạo phòng và ngẫu nhiên phân bổ người tham gia. Hiện có ${participants.length} người.`,
                  })}
                </Text>

                {/* Tiền tố tên phòng */}
                <View className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] mb-3">
                  <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t("meeting.create_breakout_modal.room_prefix_label", {
                      defaultValue: "Tiền tố tên phòng",
                    })}
                  </Text>
                  <TextInput
                    value={autoConfig.roomPrefix}
                    onChangeText={(text) =>
                      setAutoConfig({ ...autoConfig, roomPrefix: text })
                    }
                    placeholder="Nhóm"
                    placeholderTextColor="#666"
                    className="bg-[#111] border border-[#444] text-white text-sm rounded-lg px-3.5 py-3"
                  />
                </View>

                {/* Số người tối đa / phòng */}
                <View className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] mb-3">
                  <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t("meeting.create_breakout_modal.max_participants_label", {
                      defaultValue: "Số người tối đa / phòng",
                    })}
                  </Text>
                  <TextInput
                    value={String(autoConfig.maxParticipants)}
                    onChangeText={(text) =>
                      setAutoConfig({
                        ...autoConfig,
                        maxParticipants: Number(text) || 2,
                      })
                    }
                    keyboardType="number-pad"
                    className="bg-[#111] border border-[#444] text-white text-sm rounded-lg px-3.5 py-3 font-mono"
                  />
                </View>

                {/* Số lượng phòng */}
                <View className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] mb-3">
                  <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t("meeting.create_breakout_modal.room_count_label", {
                      defaultValue: "Số lượng phòng",
                    })}
                  </Text>
                  <TextInput
                    value={String(autoConfig.roomCount)}
                    onChangeText={(text) =>
                      setAutoConfig({
                        ...autoConfig,
                        roomCount: Number(text) || 1,
                      })
                    }
                    keyboardType="number-pad"
                    className="bg-[#111] border border-[#444] text-white text-sm rounded-lg px-3.5 py-3 font-mono"
                  />
                  <Text className="text-[10px] text-slate-500 italic mt-1 text-right">
                    {t("meeting.create_breakout_modal.room_count_hint", {
                      minRooms: Math.ceil(
                        participants.length /
                        Math.max(1, autoConfig.maxParticipants),
                      ),
                      count: participants.length,
                      defaultValue: `Gợi ý: Cần tối thiểu ${Math.ceil(participants.length / Math.max(1, autoConfig.maxParticipants))} phòng cho ${participants.length} người.`,
                    })}
                  </Text>
                </View>

                {/* Thời gian (phút) */}
                <View className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] mb-3">
                  <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t("meeting.create_breakout_modal.duration_label", {
                      defaultValue: "Thời gian (phút)",
                    })}
                  </Text>
                  <TextInput
                    value={String(autoConfig.durationMinutes)}
                    onChangeText={(text) =>
                      setAutoConfig({
                        ...autoConfig,
                        durationMinutes: Number(text) || 1,
                      })
                    }
                    keyboardType="number-pad"
                    className="bg-[#111] border border-[#444] text-white text-sm rounded-lg px-3.5 py-3 font-mono"
                  />
                </View>

                {/* Switch Tự động gán */}
                <View className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-white text-sm font-bold">
                      {t("meeting.create_breakout_modal.auto_assign_label", {
                        defaultValue: "Tự động thêm thành viên vào phòng",
                      })}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-1 leading-4">
                      {t("meeting.create_breakout_modal.auto_assign_sub", {
                        defaultValue:
                          "Người tham gia sẽ được tự động chuyển hướng.",
                      })}
                    </Text>
                  </View>
                  <Switch
                    value={isAutoAssign}
                    onValueChange={setIsAutoAssign}
                    trackColor={{ false: "#333", true: "#3b82f6" }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}

            {/* ================= TAB 2: MANUAL ================= */}
            {activeTab === "manual" && (
              <View>
                <Text className="text-slate-400 text-xs leading-5 mb-4">
                  {t("meeting.create_breakout_modal.manual_desc", {
                    defaultValue:
                      "Nhấn vào từng nhóm để thêm thành viên và tùy chỉnh thời lượng.",
                  })}
                </Text>

                {/* DANH SÁCH CÁC PHÒNG THỦ CÔNG */}
                <View>
                  {manualRooms.map((room, idx) => {
                    const roomUsers = participants.filter(
                      (p) => manualAssignments[p.identity] === room.id,
                    );

                    return (
                      <View
                        key={room.id}
                        className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden mb-3"
                      >
                        {/* Tiêu đề & Cài đặt phòng */}
                        <View className="px-3.5 py-3 bg-[#222] border-b border-[#333] flex-row items-center justify-between">
                          <TextInput
                            value={room.name}
                            onChangeText={(text) => {
                              const newRooms = [...manualRooms];
                              newRooms[idx].name = text;
                              setManualRooms(newRooms);
                            }}
                            className="flex-1 text-white font-bold text-sm mr-2"
                            placeholder="Tên phòng"
                            placeholderTextColor="#666"
                          />

                          <View className="flex-row items-center gap-2">
                            {/* Ô nhập thời gian nhỏ gọn, hạ bớt chiều cao */}
                            <View className="flex-row items-center bg-[#111] px-2 h-7 rounded border border-[#333]">
                              <Feather name="clock" size={11} color="#94a3b8" />
                              <TextInput
                                value={String(room.durationMinutes)}
                                onChangeText={(text) => {
                                  const newRooms = [...manualRooms];
                                  newRooms[idx].durationMinutes =
                                    Number(text) || 1;
                                  setManualRooms(newRooms);
                                }}
                                keyboardType="number-pad"
                                className="text-amber-400 text-xs font-mono w-7 text-center py-0 h-6 leading-none"
                              />
                              <Text className="text-[10px] text-slate-500">
                                {t("meeting.create_breakout_modal.minutes_unit", {
                                  defaultValue: "p",
                                })}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => {
                                if (manualRooms.length <= 1) {
                                  toast.error(
                                    t(
                                      "meeting.create_breakout_modal.error_min_room",
                                      { defaultValue: "Cần ít nhất 1 phòng" },
                                    ),
                                  );
                                  return;
                                }
                                setManualRooms(
                                  manualRooms.filter((r) => r.id !== room.id),
                                );
                                setManualAssignments((prev) => {
                                  const next = { ...prev };
                                  Object.keys(next).forEach((uid) => {
                                    if (next[uid] === room.id) delete next[uid];
                                  });
                                  return next;
                                });
                              }}
                              className="p-1.5 rounded bg-red-500/10 active:bg-red-500/20"
                            >
                              <Feather
                                name="trash-2"
                                size={14}
                                color="#f87171"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Danh sách thành viên trong phòng */}
                        <View className="p-3.5">
                          {roomUsers.length > 0 ? (
                            <View className="flex-row flex-wrap gap-2 mb-2">
                              {roomUsers.map((p) => (
                                <View
                                  key={p.identity}
                                  className="bg-[#111] border border-[#333] rounded-lg px-2.5 py-1.5 flex-row items-center gap-1.5"
                                >
                                  <View className="w-4 h-4 rounded-full bg-emerald-600 items-center justify-center">
                                    <Text className="text-[9px] font-bold text-white uppercase">
                                      {p.name?.charAt(0) || "?"}
                                    </Text>
                                  </View>
                                  <Text
                                    className="text-xs text-slate-200 font-medium max-w-[100px]"
                                    numberOfLines={1}
                                  >
                                    {p.name}
                                  </Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setManualAssignments((prev) => {
                                        const next = { ...prev };
                                        delete next[p.identity];
                                        return next;
                                      });
                                    }}
                                    className="ml-1 p-0.5"
                                  >
                                    <Feather
                                      name="x"
                                      size={12}
                                      color="#94a3b8"
                                    />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text className="text-xs text-slate-500 italic py-1">
                              {t(
                                "meeting.create_breakout_modal.drag_drop_placeholder",
                                { defaultValue: "Chưa có thành viên nào" },
                              )}
                            </Text>
                          )}

                          {/* Nút thêm thành viên vào phòng này */}
                          <TouchableOpacity
                            onPress={() => handleOpenAddMembersModal(room.id)}
                            className="py-2.5 px-3.5 bg-[#222] border border-dashed border-[#444] rounded-lg flex-row items-center justify-center gap-2 active:bg-[#2a2a2a]"
                          >
                            <Feather
                              name="user-plus"
                              size={13}
                              color="#60a5fa"
                            />
                            <Text className="text-xs text-blue-400 font-semibold">
                              {t("meeting.create_breakout_modal.add_member_button", {
                                defaultValue: "+ Thêm thành viên",
                              })}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* NÚT THÊM PHÒNG THỦ CÔNG */}
                <TouchableOpacity
                  onPress={() =>
                    setManualRooms([
                      ...manualRooms,
                      {
                        id: `room-${Date.now()}`,
                        name: `${t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} ${manualRooms.length + 1}`,
                        durationMinutes: 10,
                      },
                    ])
                  }
                  className="py-3.5 border-2 border-dashed border-[#444] rounded-xl flex-row items-center justify-center gap-2 active:bg-[#1a1a1a]"
                >
                  <Feather name="plus" size={16} color="#60a5fa" />
                  <Text className="text-sm font-semibold text-blue-400">
                    {t("meeting.create_breakout_modal.add_room_button", {
                      defaultValue: "Thêm nhóm mới",
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ================= TAB 3: SELF ================= */}
            {activeTab === "self" && (
              <View>
                <Text className="text-slate-400 mb-4 text-xs leading-5">
                  {t("meeting.create_breakout_modal.self_desc", {
                    defaultValue:
                      "Tạo các phòng trống. Người tham gia có thể tự do lựa chọn phòng muốn vào.",
                  })}
                </Text>

                <View className="space-y-4">
                  {selfRooms.map((room, index) => (
                    <View
                      key={index}
                      className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333] mb-3"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {t("meeting.create_breakout_modal.room_name_label", {
                            defaultValue: "Tên phòng",
                          })}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            if (selfRooms.length <= 1) {
                              toast.error(
                                t(
                                  "meeting.create_breakout_modal.error_min_room",
                                  { defaultValue: "Cần ít nhất 1 phòng" },
                                ),
                              );
                              return;
                            }
                            setSelfRooms(
                              selfRooms.filter((_, i) => i !== index),
                            );
                          }}
                          className="p-1 rounded bg-red-500/10"
                        >
                          <Feather name="trash-2" size={14} color="#f87171" />
                        </TouchableOpacity>
                      </View>

                      <TextInput
                        value={room.name}
                        onChangeText={(text) => {
                          const newR = [...selfRooms];
                          newR[index].name = text;
                          setSelfRooms(newR);
                        }}
                        className="bg-[#111] border border-[#444] text-white text-sm rounded-lg px-3.5 py-2.5 font-bold"
                        placeholder="Tên phòng"
                        placeholderTextColor="#666"
                      />

                      <View className="flex-row gap-3 mt-2">
                        <View className="flex-1 space-y-1.5">
                          <Text className="text-[10px] font-semibold text-slate-400 uppercase mb-2">
                            {t(
                              "meeting.create_breakout_modal.max_participants_self_label",
                              { defaultValue: "Số người tối đa" },
                            )}
                          </Text>
                          <TextInput
                            value={String(room.maxParticipants)}
                            onChangeText={(text) => {
                              const newR = [...selfRooms];
                              newR[index].maxParticipants = Number(text) || 2;
                              setSelfRooms(newR);
                            }}
                            keyboardType="number-pad"
                            className="bg-[#111] border border-[#444] text-white text-sm font-mono rounded-lg px-3 py-2.5 text-center"
                          />
                        </View>

                        <View className="flex-1 space-y-1.5">
                          <Text className="text-[10px] font-semibold text-slate-400 uppercase mb-2">
                            {t(
                              "meeting.create_breakout_modal.duration_self_label",
                              { defaultValue: "Thời gian (phút)" },
                            )}
                          </Text>
                          <TextInput
                            value={String(room.durationMinutes)}
                            onChangeText={(text) => {
                              const newR = [...selfRooms];
                              newR[index].durationMinutes = Number(text) || 1;
                              setSelfRooms(newR);
                            }}
                            keyboardType="number-pad"
                            className="bg-[#111] border border-[#444] text-white text-sm font-mono rounded-lg px-3 py-2.5 text-center"
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setSelfRooms([
                      ...selfRooms,
                      {
                        name: `${t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Nhóm" })} ${selfRooms.length + 1}`,
                        maxParticipants: 2,
                        durationMinutes: 10,
                      },
                    ])
                  }
                  className="py-3.5 border-2 border-dashed border-[#444] rounded-xl flex-row items-center justify-center gap-2 active:bg-[#1a1a1a]"
                >
                  <Feather name="plus" size={16} color="#60a5fa" />
                  <Text className="text-sm font-semibold text-blue-400">
                    {t("meeting.create_breakout_modal.add_room_self_button", {
                      defaultValue: "Thêm phòng mới",
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* FOOTER */}
          <View className="px-5 py-4 border-t border-[#222] bg-[#161616] flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 py-3.5 bg-[#222] border border-[#333] rounded-xl items-center justify-center active:bg-[#2a2a2a]"
            >
              <Text className="text-gray-300 font-semibold text-sm">
                {t("meeting.create_breakout_modal.cancel", {
                  defaultValue: "Hủy",
                })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className="flex-1 py-3.5 bg-blue-600 rounded-xl items-center justify-center flex-row gap-2 active:bg-blue-700 shadow-md"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="play" size={16} color="#ffffff" />
                  <Text className="text-white font-bold text-sm">
                    {t("meeting.create_breakout_modal.start_breakout", {
                      defaultValue: "Bắt đầu phân chia",
                    })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* MODAL MULTI-SELECT: CHỌN NHIỀU THÀNH VIÊN VÀO PHÒNG */}
        {selectingRoomId && (
          <Modal transparent animationType="fade">
            <View className="flex-1 bg-black/75 justify-center items-center p-4">
              <View className="bg-[#1c1c1c] border border-[#333] rounded-3xl w-full max-w-md h-[50%] overflow-hidden flex-col">
                {/* Header modal */}
                <View className="px-5 py-4 border-b border-[#2a2a2a] flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    <Text className="text-white font-bold text-base" numberOfLines={1}>
                      {t("meeting.create_breakout_modal.add_members_title", {
                        defaultValue: "Thêm thành viên",
                      })}
                    </Text>
                    <Text className="text-blue-400 text-xs mt-0.5" numberOfLines={1}>
                      {selectedRoomForModal?.name || "Nhóm"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectingRoomId(null)}
                    className="p-1.5 rounded-lg bg-[#282828]"
                  >
                    <Feather name="x" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* Danh sách thành viên để chọn nhiều */}
                <ScrollView
                  className="flex-1 px-4 py-3"
                  contentContainerClassName="space-y-2.5 pb-4"
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {participants.length > 0 ? (
                    participants.map((p) => {
                      const isSelected = tempSelectedUsers.includes(p.identity);
                      const currentAssignedRoomId = manualAssignments[p.identity];
                      const isAssignedToOtherRoom =
                        currentAssignedRoomId &&
                        currentAssignedRoomId !== selectingRoomId;
                      const otherRoom = isAssignedToOtherRoom
                        ? manualRooms.find((r) => r.id === currentAssignedRoomId)
                        : null;

                      return (
                        <TouchableOpacity
                          key={p.identity}
                          onPress={() => handleToggleMember(p.identity)}
                          className={`py-3 px-3.5 rounded-xl border mb-2 flex-row items-center justify-between ${isSelected
                            ? "bg-blue-600/15 border-blue-500"
                            : "bg-[#252525] border-[#333] active:bg-[#2c2c2c]"
                            }`}
                        >
                          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                            <View
                              className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? "bg-blue-600" : "bg-[#383838]"
                                }`}
                            >
                              <Text className="text-xs font-bold text-white uppercase">
                                {p.name?.charAt(0) || "?"}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text
                                className={`text-sm font-medium ${isSelected ? "text-white font-bold" : "text-slate-200"
                                  }`}
                                numberOfLines={1}
                              >
                                {p.name}
                              </Text>
                              {otherRoom && !isSelected && (
                                <Text
                                  className="text-[10px] text-amber-400 mt-0.5"
                                  numberOfLines={1}
                                >
                                  {t("meeting.create_breakout_modal.currently_in_room", {
                                    name: otherRoom.name,
                                    defaultValue: `(Đang ở: ${otherRoom.name})`,
                                  })}
                                </Text>
                              )}
                            </View>
                          </View>

                          {/* Checkbox box indicator */}
                          <View
                            className={`w-5 h-5 rounded-md border items-center justify-center ${isSelected
                              ? "bg-blue-600 border-blue-500"
                              : "border-slate-500 bg-[#1e1e1e]"
                              }`}
                          >
                            {isSelected && (
                              <Feather name="check" size={13} color="#ffffff" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text className="text-slate-400 text-xs text-center py-6">
                      {t("meeting.create_breakout_modal.no_participants_in_meeting", {
                        defaultValue: "Không có thành viên nào trong cuộc họp",
                      })}
                    </Text>
                  )}
                </ScrollView>

                {/* Footer với nút Xác nhận & Hủy */}
                <View className="p-4 border-t border-[#2a2a2a] bg-[#181818] flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={() => setSelectingRoomId(null)}
                    className="flex-1 py-3 bg-[#262626] border border-[#383838] rounded-xl items-center"
                  >
                    <Text className="text-gray-400 font-semibold text-xs">
                      {t("meeting.create_breakout_modal.cancel", {
                        defaultValue: "Hủy",
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleConfirmSelectedMembers}
                    className="flex-1 py-3 bg-blue-600 rounded-xl items-center justify-center flex-row gap-1.5 active:bg-blue-700"
                  >
                    <Feather name="check" size={14} color="#ffffff" />
                    <Text className="text-white font-bold text-xs">
                      {t("meeting.create_breakout_modal.confirm_selected", {
                        count: tempSelectedUsers.length,
                        defaultValue: `Xác nhận (${tempSelectedUsers.length})`,
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
