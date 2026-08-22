// components/meeting/CreateBreakoutModal.tsx
import React, { useState, useMemo, useEffect } from "react";
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
import { Feather } from "@expo/vector-icons";
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

type BreakoutMode = "auto" | "manual" | "free_choose";

interface LocalRoom {
  id: string;
  name: string;
  assignedUserIds: string[];
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

  // Step state: 1 (Setup) | 2 (Assignment & Review)
  const [step, setStep] = useState<1 | 2>(1);

  // Mode state
  const [mode, setMode] = useState<BreakoutMode>("auto");

  // Step 1 Form States
  const [roomCount, setRoomCount] = useState<number>(2);
  const [roomPrefix, setRoomPrefix] = useState<string>(
    t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Phòng" }),
  );

  // Step 2 Local Rooms State
  const [rooms, setRooms] = useState<LocalRoom[]>([]);

  // Expanded room IDs state (Accordion: Set of room IDs that are open)
  const [expandedRoomIds, setExpandedRoomIds] = useState<Set<string>>(
    new Set(),
  );

  // Editing Room Name inline state
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState<string>("");

  // Action Menu state on participant (3 dots menu)
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<
    "move" | "exchange" | null
  >(null);

  // Settings / Options state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAutoCloseEnabled, setIsAutoCloseEnabled] = useState<boolean>(false);
  const [autoCloseMinutes, setAutoCloseMinutes] = useState<number>(15);

  // Multi-select Add Participants Modal State
  const [addModalTargetRoomId, setAddModalTargetRoomId] = useState<
    string | null
  >(null);
  const [selectedUserIdsToAdd, setSelectedUserIdsToAdd] = useState<string[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Assignable participants (if multiple, exclude host/local if possible, else take all)
  const assignableParticipants = useMemo(() => {
    const nonLocal = participants.filter((p) => !p.isLocal);
    return nonLocal.length > 0 ? nonLocal : participants;
  }, [participants]);

  // Unassigned participants pool
  const unassignedParticipants = useMemo(() => {
    const assignedSet = new Set<string>();
    rooms.forEach((r) =>
      r.assignedUserIds.forEach((uid) => assignedSet.add(uid)),
    );
    return assignableParticipants.filter((p) => !assignedSet.has(p.identity));
  }, [assignableParticipants, rooms]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setMode("auto");
      setRoomCount(2);
      setRoomPrefix(
        t("meeting.create_breakout_modal.room_prefix", {
          defaultValue: "Phòng",
        }),
      );
      setRooms([]);
      setExpandedRoomIds(new Set());
      setEditingRoomId(null);
      setActiveMenuUserId(null);
      setActiveSubMenu(null);
      setIsSettingsOpen(false);
      setIsAutoCloseEnabled(false);
      setAutoCloseMinutes(15);
      setAddModalTargetRoomId(null);
    }
  }, [isOpen, t]);

  if (!isOpen) return null;

  // Helper to generate & partition rooms
  const generateRoomsForStep2 = (
    currentMode: BreakoutMode,
    count: number,
    prefix: string,
  ) => {
    const pfx =
      prefix.trim() ||
      t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Phòng" });
    const countNum = Math.max(1, count);

    const newRooms: LocalRoom[] = Array.from({ length: countNum }, (_, i) => ({
      id: `room_${Date.now()}_${i + 1}`,
      name: `${pfx} ${i + 1}`,
      assignedUserIds: [],
    }));

    if (currentMode === "auto") {
      // Shuffle and partition evenly
      const shuffled = [...assignableParticipants].sort(
        () => 0.5 - Math.random(),
      );
      shuffled.forEach((p, index) => {
        const targetRoomIndex = index % countNum;
        newRooms[targetRoomIndex].assignedUserIds.push(p.identity);
      });
    }

    setRooms(newRooms);
    // Expand all rooms by default for quick overview
    setExpandedRoomIds(new Set(newRooms.map((r) => r.id)));
  };

  // Step 1 -> Step 2
  const handleProceedToStep2 = () => {
    if (roomCount < 1) {
      toast.error(
        t("meeting.create_breakout_modal.error_min_room", {
          defaultValue: "Cần ít nhất 1 phòng",
        }),
      );
      return;
    }

    generateRoomsForStep2(mode, roomCount, roomPrefix);
    setStep(2);
  };

  // Toggle room expand/collapse
  const toggleRoomExpand = (roomId: string) => {
    setExpandedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  // Expand all / Collapse all toggle
  const toggleAllRooms = () => {
    if (expandedRoomIds.size === rooms.length) {
      setExpandedRoomIds(new Set());
    } else {
      setExpandedRoomIds(new Set(rooms.map((r) => r.id)));
    }
  };

  // Shuffle again in Step 2 (Auto mode)
  const handleShuffleAgain = () => {
    if (rooms.length === 0) return;
    const shuffled = [...assignableParticipants].sort(
      () => 0.5 - Math.random(),
    );
    const updated = rooms.map((r) => ({
      ...r,
      assignedUserIds: [] as string[],
    }));

    shuffled.forEach((p, index) => {
      const targetRoomIndex = index % updated.length;
      updated[targetRoomIndex].assignedUserIds.push(p.identity);
    });

    setRooms(updated);
    toast.success(
      t("meeting.create_breakout_modal.shuffle_again", {
        defaultValue: "Chia ngẫu nhiên lại",
      }),
    );
  };

  // Add new room in Step 2
  const handleAddRoom = () => {
    const pfx =
      roomPrefix.trim() ||
      t("meeting.create_breakout_modal.room_prefix", { defaultValue: "Phòng" });
    const newId = `room_${Date.now()}_${rooms.length + 1}`;
    const newRoom: LocalRoom = {
      id: newId,
      name: `${pfx} ${rooms.length + 1}`,
      assignedUserIds: [],
    };
    setRooms((prev) => [...prev, newRoom]);
    setExpandedRoomIds((prev) => new Set([...prev, newId]));
  };

  // Delete room in Step 2
  const handleDeleteRoom = (roomId: string) => {
    if (rooms.length <= 1) {
      toast.error(
        t("meeting.create_breakout_modal.error_min_room", {
          defaultValue: "Cần ít nhất 1 phòng",
        }),
      );
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setExpandedRoomIds((prev) => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
    if (editingRoomId === roomId) {
      setEditingRoomId(null);
    }
  };

  // Rename room inline
  const handleStartRenameRoom = (roomId: string, currentName: string) => {
    setEditingRoomId(roomId);
    setEditingRoomName(currentName);
  };

  const handleSaveRoomName = (roomId: string) => {
    if (!editingRoomName.trim()) {
      toast.error(
        t("meeting.create_breakout_modal.error_room_name_empty", {
          defaultValue: "Tên phòng không được để trống",
        }),
      );
      return;
    }
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId ? { ...r, name: editingRoomName.trim() } : r,
      ),
    );
    setEditingRoomId(null);
  };

  // Remove participant from room
  const handleRemoveParticipant = (roomId: string, userId: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
            ...r,
            assignedUserIds: r.assignedUserIds.filter((id) => id !== userId),
          }
          : r,
      ),
    );
    setActiveMenuUserId(null);
    setActiveSubMenu(null);
  };

  // Move participant to another room
  const handleMoveParticipant = (
    fromRoomId: string,
    toRoomId: string,
    userId: string,
  ) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === fromRoomId) {
          return {
            ...r,
            assignedUserIds: r.assignedUserIds.filter((id) => id !== userId),
          };
        }
        if (r.id === toRoomId) {
          return {
            ...r,
            assignedUserIds: [...r.assignedUserIds, userId],
          };
        }
        return r;
      }),
    );
    setActiveMenuUserId(null);
    setActiveSubMenu(null);
  };

  // Exchange participant with someone in another room
  const handleExchangeParticipant = (
    fromRoomId: string,
    fromUserId: string,
    toRoomId: string,
    toUserId: string,
  ) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === fromRoomId) {
          return {
            ...r,
            assignedUserIds: r.assignedUserIds.map((id) =>
              id === fromUserId ? toUserId : id,
            ),
          };
        }
        if (r.id === toRoomId) {
          return {
            ...r,
            assignedUserIds: r.assignedUserIds.map((id) =>
              id === toUserId ? fromUserId : id,
            ),
          };
        }
        return r;
      }),
    );
    setActiveMenuUserId(null);
    setActiveSubMenu(null);
  };

  // Open multi-select modal for adding users
  const handleOpenAddModal = (roomId: string) => {
    setAddModalTargetRoomId(roomId);
    setSelectedUserIdsToAdd([]);
    setSearchQuery("");
  };

  // Confirm multi-select add users
  const handleConfirmAddUsers = () => {
    if (!addModalTargetRoomId || selectedUserIdsToAdd.length === 0) return;

    setRooms((prev) =>
      prev.map((r) =>
        r.id === addModalTargetRoomId
          ? {
            ...r,
            assignedUserIds: [
              ...r.assignedUserIds,
              ...selectedUserIdsToAdd,
            ],
          }
          : r,
      ),
    );
    setExpandedRoomIds((prev) => new Set([...prev, addModalTargetRoomId]));
    setAddModalTargetRoomId(null);
    setSelectedUserIdsToAdd([]);
  };

  // Toggle user selection in add modal
  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIdsToAdd((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  // Submit and start breakout session
  const handleSubmit = async () => {
    if (rooms.length === 0) {
      toast.error(
        t("meeting.create_breakout_modal.error_min_room", {
          defaultValue: "Cần ít nhất 1 phòng",
        }),
      );
      return;
    }
    if (rooms.some((r) => !r.name.trim())) {
      toast.error(
        t("meeting.create_breakout_modal.error_room_name_empty", {
          defaultValue: "Tên phòng không được để trống",
        }),
      );
      return;
    }

    const durationToUse =
      isAutoCloseEnabled && autoCloseMinutes > 0 ? autoCloseMinutes : undefined;

    const payloadRooms: CreateBreakoutRoomDto[] = rooms.map((r) => ({
      name: r.name.trim(),
      durationMinutes: durationToUse,
      assignedUsers: mode === "free_choose" ? undefined : r.assignedUserIds,
    }));

    try {
      await startBreakoutApi({
        code: meetingCode,
        rooms: payloadRooms,
        durationMinutes: durationToUse,
      }).unwrap();

      toast.success(
        t("meeting.create_breakout_modal.success_start", {
          defaultValue: "Đã mở các phòng thảo luận nhóm!",
        }),
      );
      onClose();
    } catch (error: any) {
      if (error?.status === 400) {
        toast.error(
          t("meeting.create_breakout_modal.error_invalid_data", {
            defaultValue: "Dữ liệu không hợp lệ.",
          }),
        );
      } else {
        toast.error(
          t("meeting.create_breakout_modal.error_create_failed", {
            defaultValue: "Lỗi khi tạo phòng thảo luận.",
          }),
        );
      }
    }
  };

  // Find user details helper
  const getParticipantInfo = (userId: string) => {
    const p = participants.find((item) => item.identity === userId);
    return {
      name: p?.name || userId,
      initial: (p?.name || userId).charAt(0).toUpperCase(),
    };
  };

  // Target room for the Add Modal
  const targetRoomForAdd = rooms.find((r) => r.id === addModalTargetRoomId);

  // Filter unassigned participants for the add modal
  const filteredUnassigned = unassignedParticipants.filter((p) =>
    (p.name || p.identity)
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim()),
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
          paddingBottom: Math.max(insets.bottom, 10),
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (activeMenuUserId) {
              setActiveMenuUserId(null);
              setActiveSubMenu(null);
            } else if (isSettingsOpen) {
              setIsSettingsOpen(false);
            } else {
              onClose();
            }
          }}
          className="flex-1"
        />

        <View className="bg-[#111] h-[85%] rounded-t-3xl border-t border-[#333] flex-col overflow-hidden">
          {/* DRAG HANDLE */}
          <View className="w-10 h-1 bg-[#444] rounded-full self-center mt-3 mb-2" />

          {/* HEADER */}
          <View className="px-5 py-3 border-b border-[#222] flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text
                    className="text-white text-sm font-bold mr-2"
                    numberOfLines={1}
                  >
                    {step === 1
                      ? t("meeting.create_breakout_modal.step_1_title", {
                        defaultValue: "Tạo phòng theo nhóm",
                      })
                      : t("meeting.create_breakout_modal.step_2_title", {
                        defaultValue: "Phân chia thành viên",
                      })}
                  </Text>
                  <View className="px-2 py-0.5 rounded-full bg-[#222] border border-[#333]">
                    <Text className="text-[10px] font-semibold text-gray-400">
                      {step === 1 ? "1 / 2" : "2 / 2"}
                    </Text>
                  </View>
                </View>
                <Text
                  className="text-[11px] text-gray-400 mt-0.5"
                  numberOfLines={1}
                >
                  {step === 1
                    ? t("meeting.create_breakout_modal.step_1_subtitle", {
                      defaultValue:
                        "Chọn số lượng phòng và phương thức chia phòng",
                    })
                    : t("meeting.create_breakout_modal.step_2_subtitle", {
                      defaultValue:
                        "Xem và tuỳ chỉnh thành viên trong từng nhóm",
                    })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="p-1.5 rounded-lg bg-[#222] border border-[#333]"
            >
              <Feather name="x" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* BODY */}
          <View className="flex-1 bg-[#111] relative">
            {/* ================= STEP 1: SETUP & MODE SELECTION ================= */}
            {step === 1 && (
              <ScrollView
                className="flex-1 p-4"
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Room Count Card */}
                <View className="bg-[#222] p-4 rounded-2xl border border-[#333] mb-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <Text className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        {t("meeting.create_breakout_modal.room_count", {
                          defaultValue: "Số lượng phòng",
                        })}
                      </Text>
                      <Text className="text-[11px] text-gray-400 mt-0.5">
                        {t(
                          "meeting.create_breakout_modal.total_participants_hint",
                          {
                            count: assignableParticipants.length,
                            defaultValue: `Hiện có ${assignableParticipants.length} người tham gia`,
                          },
                        )}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <TouchableOpacity
                        onPress={() => setRoomCount((c) => Math.max(1, c - 1))}
                        className="w-8 h-8 rounded-lg bg-[#333] border border-[#444] items-center justify-center mr-2 active:bg-[#444]"
                      >
                        <Feather name="minus" size={16} color="#ffffff" />
                      </TouchableOpacity>

                      <View className="w-12 h-8 bg-[#1a1a1a] border border-[#444] rounded-lg items-center justify-center mr-2">
                        <Text className="text-white text-sm font-mono font-bold">
                          {roomCount}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => setRoomCount((c) => Math.min(50, c + 1))}
                        className="w-8 h-8 rounded-lg bg-[#333] border border-[#444] items-center justify-center active:bg-[#444]"
                      >
                        <Feather name="plus" size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {mode === "auto" && assignableParticipants.length > 0 && (
                    <View className="mt-3 pt-3 border-t border-[#333] flex-row items-center justify-between">
                      <Text className="text-gray-400 text-xs">
                        {t(
                          "meeting.create_breakout_modal.expected_distribution",
                          {
                            defaultValue: "Dự kiến phân bổ",
                          },
                        )}
                      </Text>
                      <Text className="text-blue-400 font-semibold text-xs">
                        {t("meeting.create_breakout_modal.auto_calc_hint", {
                          count: Math.ceil(
                            assignableParticipants.length /
                            Math.max(1, roomCount),
                          ),
                          defaultValue: `~${Math.ceil(
                            assignableParticipants.length /
                            Math.max(1, roomCount),
                          )} người / phòng`,
                        })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Division Mode Options */}
                <Text className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                  {t("meeting.create_breakout_modal.mode_title", {
                    defaultValue: "Chọn phương thức chia phòng",
                  })}
                </Text>

                {/* Option 1: Auto */}
                <TouchableOpacity
                  onPress={() => setMode("auto")}
                  activeOpacity={0.8}
                  className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-start ${mode === "auto"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[#333] bg-[#222]"
                    }`}
                >
                  <View
                    className={`p-2 rounded-xl mr-3 ${mode === "auto"
                      ? "bg-blue-600"
                      : "bg-[#333] border border-[#444]"
                      }`}
                  >
                    <Feather
                      name="zap"
                      size={16}
                      color={mode === "auto" ? "#ffffff" : "#94a3b8"}
                    />
                  </View>

                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-xs font-bold ${mode === "auto" ? "text-blue-400" : "text-gray-200"
                          }`}
                      >
                        {t("meeting.create_breakout_modal.mode_auto", {
                          defaultValue: "Tự động gán",
                        })}
                      </Text>
                    </View>
                    <Text className="text-[11px] text-gray-400 mt-1 leading-4">
                      {t("meeting.create_breakout_modal.mode_auto_desc", {
                        defaultValue:
                          "Hệ thống tự động chia đều người tham gia vào các phòng",
                      })}
                    </Text>
                  </View>

                  <View
                    className={`w-4 h-4 rounded-full border items-center justify-center mt-0.5 ${mode === "auto"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-500"
                      }`}
                  >
                    {mode === "auto" && (
                      <View className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Option 2: Manual */}
                <TouchableOpacity
                  onPress={() => setMode("manual")}
                  activeOpacity={0.8}
                  className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-start ${mode === "manual"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[#333] bg-[#222]"
                    }`}
                >
                  <View
                    className={`p-2 rounded-xl mr-3 ${mode === "manual"
                      ? "bg-blue-600"
                      : "bg-[#333] border border-[#444]"
                      }`}
                  >
                    <Feather
                      name="user-check"
                      size={16}
                      color={mode === "manual" ? "#ffffff" : "#94a3b8"}
                    />
                  </View>

                  <View className="flex-1 mr-2">
                    <Text
                      className={`text-xs font-bold ${mode === "manual" ? "text-blue-400" : "text-gray-200"
                        }`}
                    >
                      {t("meeting.create_breakout_modal.mode_manual", {
                        defaultValue: "Gán thủ công",
                      })}
                    </Text>
                    <Text className="text-[11px] text-gray-400 mt-1 leading-4">
                      {t("meeting.create_breakout_modal.mode_manual_desc", {
                        defaultValue:
                          "Tự tay chọn và phân công người tham gia vào từng phòng",
                      })}
                    </Text>
                  </View>

                  <View
                    className={`w-4 h-4 rounded-full border items-center justify-center mt-0.5 ${mode === "manual"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-500"
                      }`}
                  >
                    {mode === "manual" && (
                      <View className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Option 3: Free choose */}
                <TouchableOpacity
                  onPress={() => setMode("free_choose")}
                  activeOpacity={0.8}
                  className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-start ${mode === "free_choose"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[#333] bg-[#222]"
                    }`}
                >
                  <View
                    className={`p-2 rounded-xl mr-3 ${mode === "free_choose"
                      ? "bg-blue-600"
                      : "bg-[#333] border border-[#444]"
                      }`}
                  >
                    <Feather
                      name="star"
                      size={16}
                      color={mode === "free_choose" ? "#ffffff" : "#94a3b8"}
                    />
                  </View>

                  <View className="flex-1 mr-2">
                    <Text
                      className={`text-xs font-bold ${mode === "free_choose"
                        ? "text-blue-400"
                        : "text-gray-200"
                        }`}
                    >
                      {t("meeting.create_breakout_modal.mode_free", {
                        defaultValue: "Người tham gia tự chọn",
                      })}
                    </Text>
                    <Text className="text-[11px] text-gray-400 mt-1 leading-4">
                      {t("meeting.create_breakout_modal.mode_free_desc", {
                        defaultValue:
                          "Cho phép mọi người tự do chọn và vào phòng tùy thích",
                      })}
                    </Text>
                  </View>

                  <View
                    className={`w-4 h-4 rounded-full border items-center justify-center mt-0.5 ${mode === "free_choose"
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-500"
                      }`}
                  >
                    {mode === "free_choose" && (
                      <View className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </View>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* ================= STEP 2: ASSIGNMENT & ROOM MANAGEMENT ================= */}
            {step === 2 && (
              <View className="flex-1 flex-col">
                {/* Step 2 Top Sub-Bar */}
                <View className="px-4 py-2 border-b border-[#222] bg-[#1a1a1a] flex-row items-center justify-between">
                  <View className="flex-1 mr-2">
                    {mode !== "free_choose" && (
                      <View
                        className={`px-2 py-0.5 rounded-lg border self-start ${unassignedParticipants.length > 0
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-[#222] border-[#333]"
                          }`}
                      >
                        <Text
                          className={`text-[11px] font-medium ${unassignedParticipants.length > 0
                            ? "text-amber-400"
                            : "text-gray-400"
                            }`}
                        >
                          {t("meeting.create_breakout_modal.unassigned_count", {
                            count: unassignedParticipants.length,
                            defaultValue: `Chưa phân công: ${unassignedParticipants.length} người`,
                          })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center">
                    {/* Shuffle again (Auto mode only) */}
                    {mode === "auto" && (
                      <TouchableOpacity
                        onPress={handleShuffleAgain}
                        className="px-2.5 py-1.5 bg-[#222] border border-[#333] rounded-xl mr-2 flex-row items-center active:bg-[#333]"
                      >
                        <Feather name="refresh-cw" size={12} color="#94a3b8" />
                        <Text className="text-gray-300 text-xs font-semibold ml-1.5">
                          {t("meeting.create_breakout_modal.shuffle_again", {
                            defaultValue: "Chia ngẫu nhiên",
                          })}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Expand / Collapse all toggle */}
                    <TouchableOpacity
                      onPress={toggleAllRooms}
                      className="p-1.5 bg-[#222] border border-[#333] rounded-xl mr-2"
                    >
                      <Feather
                        name={
                          expandedRoomIds.size === rooms.length
                            ? "chevron-down"
                            : "chevron-right"
                        }
                        size={16}
                        color="#94a3b8"
                      />
                    </TouchableOpacity>

                    {/* Add Room button */}
                    <TouchableOpacity
                      onPress={handleAddRoom}
                      className="px-2.5 py-1.5 bg-blue-600/15 border border-blue-500/30 rounded-xl flex-row items-center active:bg-blue-600/25"
                    >
                      <Feather name="plus" size={13} color="#60a5fa" />
                      <Text className="text-blue-400 text-xs font-semibold ml-1">
                        {t("meeting.create_breakout_modal.add_room", {
                          defaultValue: "Thêm phòng",
                        })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Rooms Vertical Accordion List */}
                <ScrollView
                  className="flex-1 p-3.5"
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                >
                  {mode === "free_choose" && (
                    <View className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex-row items-center mb-3">
                      <Feather name="info" size={14} color="#60a5fa" />
                      <Text className="text-blue-300 text-xs ml-2 flex-1 leading-4">
                        {t("meeting.create_breakout_modal.free_choose_notice", {
                          defaultValue:
                            "Tất cả người tham gia trong cuộc họp có thể tự do tham gia bất kỳ phòng nào dưới đây.",
                        })}
                      </Text>
                    </View>
                  )}

                  {rooms.map((room) => {
                    const isExpanded = expandedRoomIds.has(room.id);
                    const isEditing = editingRoomId === room.id;

                    return (
                      <View
                        key={room.id}
                        className="bg-[#222] border border-[#333] rounded-2xl mb-2.5 overflow-hidden"
                      >
                        {/* Room Header Row */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleRoomExpand(room.id)}
                          className={`px-3.5 py-3 flex-row items-center justify-between ${isExpanded
                            ? "bg-[#2a2a2a] border-b border-[#333]"
                            : ""
                            }`}
                        >
                          <View className="flex-row items-center flex-1 mr-2">
                            <Feather
                              name={
                                isExpanded ? "chevron-down" : "chevron-right"
                              }
                              size={16}
                              color="#94a3b8"
                              style={{ marginRight: 6 }}
                            />

                            {isEditing ? (
                              <View className="flex-row items-center flex-1 mr-2">
                                <TextInput
                                  value={editingRoomName}
                                  onChangeText={setEditingRoomName}
                                  autoFocus
                                  className="bg-[#111] border border-blue-500 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 flex-1 mr-2"
                                />
                                <TouchableOpacity
                                  onPress={() => handleSaveRoomName(room.id)}
                                  className="p-1.5 bg-emerald-500/10 rounded-lg mr-1"
                                >
                                  <Feather
                                    name="check"
                                    size={14}
                                    color="#34d399"
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => setEditingRoomId(null)}
                                  className="p-1.5 bg-red-500/10 rounded-lg"
                                >
                                  <Feather
                                    name="x"
                                    size={14}
                                    color="#f87171"
                                  />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View className="flex-row items-center flex-1">
                                <Text
                                  className="font-bold text-white text-xs mr-2"
                                  numberOfLines={1}
                                >
                                  {room.name}
                                </Text>
                                {mode !== "free_choose" && (
                                  <Text className="text-[11px] text-gray-400">
                                    ({room.assignedUserIds.length})
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>

                          {/* Room Action Buttons */}
                          <View className="flex-row items-center">
                            {mode !== "free_choose" && (
                              <TouchableOpacity
                                onPress={() => handleOpenAddModal(room.id)}
                                className="px-2 py-1 bg-blue-500/10 rounded-lg mr-1.5 flex-row items-center"
                              >
                                <Feather
                                  name="user-plus"
                                  size={12}
                                  color="#60a5fa"
                                />
                                <Text className="text-blue-400 text-[11px] font-medium ml-1">
                                  {t(
                                    "meeting.create_breakout_modal.assign_participants",
                                    { defaultValue: "Chỉ định" },
                                  )}
                                </Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              onPress={() =>
                                handleStartRenameRoom(room.id, room.name)
                              }
                              className="p-1.5 bg-[#333] border border-[#444] rounded-lg mr-1.5"
                            >
                              <Feather name="edit-2" size={12} color="#94a3b8" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleDeleteRoom(room.id)}
                              disabled={rooms.length <= 1}
                              className={`p-1.5 rounded-lg ${rooms.length <= 1
                                ? "opacity-30 bg-[#333]"
                                : "bg-red-500/10 border border-red-500/20"
                                }`}
                            >
                              <Feather
                                name="trash-2"
                                size={12}
                                color={
                                  rooms.length <= 1 ? "#94a3b8" : "#f87171"
                                }
                              />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>

                        {/* Room Expanded Content */}
                        {isExpanded && (
                          <View className="bg-[#1a1a1a]">
                            {mode === "free_choose" ? (
                              <View className="py-3 px-4 items-center justify-center">
                                <Text className="text-gray-500 text-xs italic text-center">
                                  {t(
                                    "meeting.create_breakout_modal.mode_free_desc",
                                    {
                                      defaultValue:
                                        "Cho phép mọi người tự do chọn và vào phòng tùy thích",
                                    },
                                  )}
                                </Text>
                              </View>
                            ) : room.assignedUserIds.length === 0 ? (
                              <View className="py-3 px-4 flex-row items-center justify-between">
                                <Text className="text-xs text-gray-500 italic">
                                  {t(
                                    "meeting.create_breakout_modal.no_participants",
                                    {
                                      defaultValue:
                                        "Chưa có thành viên nào trong nhóm",
                                    },
                                  )}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => handleOpenAddModal(room.id)}
                                  className="flex-row items-center"
                                >
                                  <Feather
                                    name="plus"
                                    size={12}
                                    color="#60a5fa"
                                  />
                                  <Text className="text-blue-400 text-xs font-semibold ml-1">
                                    {t(
                                      "meeting.create_breakout_modal.add_participants",
                                      { defaultValue: "Thêm người" },
                                    )}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              room.assignedUserIds.map((userId) => {
                                const pInfo = getParticipantInfo(userId);
                                const isMenuOpen = activeMenuUserId === userId;

                                return (
                                  <View
                                    key={userId}
                                    className="border-b border-[#262626] last:border-b-0"
                                  >
                                    <View
                                      className={`px-4 py-2.5 flex-row items-center justify-between ${isMenuOpen ? "bg-[#222]" : ""
                                        }`}
                                    >
                                      <View className="flex-row items-center flex-1 mr-2">
                                        <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center mr-2.5">
                                          <Text className="text-white text-[10px] font-bold">
                                            {pInfo.initial}
                                          </Text>
                                        </View>
                                        <Text
                                          className="text-xs font-medium text-gray-200 flex-1"
                                          numberOfLines={1}
                                        >
                                          {pInfo.name}
                                        </Text>
                                      </View>

                                      <TouchableOpacity
                                        onPress={() => {
                                          if (isMenuOpen) {
                                            setActiveMenuUserId(null);
                                            setActiveSubMenu(null);
                                          } else {
                                            setActiveMenuUserId(userId);
                                            setActiveSubMenu(null);
                                          }
                                        }}
                                        className="p-1 rounded-lg bg-[#222] border border-[#333]"
                                      >
                                        <Feather
                                          name="more-vertical"
                                          size={13}
                                          color="#94a3b8"
                                        />
                                      </TouchableOpacity>
                                    </View>

                                    {/* Action Sub-Menu */}
                                    {isMenuOpen && (
                                      <View className="bg-[#111] p-2.5 mx-3 mb-2.5 rounded-xl border border-[#333]">
                                        {/* Option 1: Remove */}
                                        <TouchableOpacity
                                          onPress={() => {
                                            handleRemoveParticipant(
                                              room.id,
                                              userId,
                                            );
                                          }}
                                          className="p-2 rounded-lg flex-row items-center mb-1 bg-red-500/10 border border-red-500/20"
                                        >
                                          <Feather
                                            name="user-minus"
                                            size={13}
                                            color="#f87171"
                                          />
                                          <Text className="text-red-400 text-xs font-semibold ml-2">
                                            {t(
                                              "meeting.create_breakout_modal.remove_from_room",
                                              {
                                                defaultValue: "Xoá khỏi phòng",
                                              },
                                            )}
                                          </Text>
                                        </TouchableOpacity>

                                        {/* Option 2: Move */}
                                        <View className="mb-1">
                                          <TouchableOpacity
                                            onPress={() =>
                                              setActiveSubMenu((prev) =>
                                                prev === "move" ? null : "move",
                                              )
                                            }
                                            className="p-2 rounded-lg bg-[#222] border border-[#333] flex-row items-center justify-between"
                                          >
                                            <View className="flex-row items-center">
                                              <Feather
                                                name="arrow-right-circle"
                                                size={13}
                                                color="#60a5fa"
                                              />
                                              <Text className="text-blue-400 text-xs font-semibold ml-2">
                                                {t(
                                                  "meeting.create_breakout_modal.move_to_room",
                                                  {
                                                    defaultValue: "Chuyển sang",
                                                  },
                                                )}
                                              </Text>
                                            </View>
                                            <Feather
                                              name={
                                                activeSubMenu === "move"
                                                  ? "chevron-down"
                                                  : "chevron-right"
                                              }
                                              size={13}
                                              color="#60a5fa"
                                            />
                                          </TouchableOpacity>

                                          {activeSubMenu === "move" && (
                                            <View className="mt-1 pl-3 border-l border-[#333]">
                                              {rooms
                                                .filter((r) => r.id !== room.id)
                                                .map((otherRoom) => (
                                                  <TouchableOpacity
                                                    key={otherRoom.id}
                                                    onPress={() => {
                                                      handleMoveParticipant(
                                                        room.id,
                                                        otherRoom.id,
                                                        userId,
                                                      );
                                                    }}
                                                    className="py-1.5 px-2 rounded flex-row items-center justify-between"
                                                  >
                                                    <Text className="text-xs text-gray-300">
                                                      {otherRoom.name}
                                                    </Text>
                                                    <Text className="text-[10px] text-gray-500">
                                                      (
                                                      {
                                                        otherRoom
                                                          .assignedUserIds
                                                          .length
                                                      }
                                                      )
                                                    </Text>
                                                  </TouchableOpacity>
                                                ))}
                                            </View>
                                          )}
                                        </View>

                                        {/* Option 3: Exchange */}
                                        <View>
                                          <TouchableOpacity
                                            onPress={() =>
                                              setActiveSubMenu((prev) =>
                                                prev === "exchange"
                                                  ? null
                                                  : "exchange",
                                              )
                                            }
                                            className="p-2 rounded-lg bg-[#222] border border-[#333] flex-row items-center justify-between"
                                          >
                                            <View className="flex-row items-center">
                                              <Feather
                                                name="repeat"
                                                size={13}
                                                color="#fbbf24"
                                              />
                                              <Text className="text-amber-400 text-xs font-semibold ml-2">
                                                {t(
                                                  "meeting.create_breakout_modal.exchange_with",
                                                  {
                                                    defaultValue:
                                                      "Đổi chỗ với",
                                                  },
                                                )}
                                              </Text>
                                            </View>
                                            <Feather
                                              name={
                                                activeSubMenu === "exchange"
                                                  ? "chevron-down"
                                                  : "chevron-right"
                                              }
                                              size={13}
                                              color="#fbbf24"
                                            />
                                          </TouchableOpacity>

                                          {activeSubMenu === "exchange" && (
                                            <View className="mt-1 pl-3 border-l border-[#333]">
                                              {rooms
                                                .filter((r) => r.id !== room.id)
                                                .flatMap((otherRoom) =>
                                                  otherRoom.assignedUserIds.map(
                                                    (otherUid) => ({
                                                      room: otherRoom,
                                                      uid: otherUid,
                                                      info: getParticipantInfo(
                                                        otherUid,
                                                      ),
                                                    }),
                                                  ),
                                                )
                                                .map(
                                                  ({
                                                    room: oRoom,
                                                    uid: oUid,
                                                    info: oInfo,
                                                  }) => (
                                                    <TouchableOpacity
                                                      key={oUid}
                                                      onPress={() => {
                                                        handleExchangeParticipant(
                                                          room.id,
                                                          userId,
                                                          oRoom.id,
                                                          oUid,
                                                        );
                                                      }}
                                                      className="py-1.5 px-2 rounded flex-row items-center justify-between"
                                                    >
                                                      <Text className="text-xs text-gray-300">
                                                        {oInfo.name}
                                                      </Text>
                                                      <Text className="text-[10px] text-gray-500">
                                                        ({oRoom.name})
                                                      </Text>
                                                    </TouchableOpacity>
                                                  ),
                                                )}

                                              {rooms.filter(
                                                (r) =>
                                                  r.id !== room.id &&
                                                  r.assignedUserIds.length > 0,
                                              ).length === 0 && (
                                                  <Text className="text-[10px] text-gray-500 italic p-1">
                                                    {t(
                                                      "meeting.create_breakout_modal.no_other_participants",
                                                      {
                                                        defaultValue:
                                                          "Không có thành viên ở phòng khác",
                                                      },
                                                    )}
                                                  </Text>
                                                )}
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                );
                              })
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ================= MULTI-SELECT ADD PARTICIPANTS MODAL ================= */}
            {addModalTargetRoomId && targetRoomForAdd && (
              <View className="absolute inset-0 z-50 bg-black/75 p-4 justify-center items-center">
                <View className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl overflow-hidden max-h-[85%] flex-col">
                  {/* Header */}
                  <View className="px-4 py-3 border-b border-[#222] flex-row items-center justify-between">
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-white text-xs font-bold"
                        numberOfLines={1}
                      >
                        {t(
                          "meeting.create_breakout_modal.select_participants_title",
                          {
                            roomName: targetRoomForAdd.name,
                            defaultValue: `Thêm người vào ${targetRoomForAdd.name}`,
                          },
                        )}
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">
                        {t("meeting.create_breakout_modal.unassigned_count", {
                          count: unassignedParticipants.length,
                          defaultValue: `Chưa phân công: ${unassignedParticipants.length} người`,
                        })}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => setAddModalTargetRoomId(null)}
                      className="p-1 rounded-lg bg-[#222] border border-[#333]"
                    >
                      <Feather name="x" size={15} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  {/* Search & Select All */}
                  <View className="p-2.5 border-b border-[#222] bg-[#111] flex-row items-center">
                    <View className="flex-1 flex-row items-center bg-[#222] border border-[#333] rounded-xl px-2.5 py-1 mr-2">
                      <Feather name="search" size={13} color="#94a3b8" />
                      <TextInput
                        placeholder={t(
                          "meeting.create_breakout_modal.search_participant",
                          { defaultValue: "Tìm kiếm thành viên..." },
                        )}
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="flex-1 text-white text-xs ml-2 py-0.5"
                      />
                    </View>

                    {filteredUnassigned.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          if (
                            selectedUserIdsToAdd.length ===
                            filteredUnassigned.length
                          ) {
                            setSelectedUserIdsToAdd([]);
                          } else {
                            setSelectedUserIdsToAdd(
                              filteredUnassigned.map((p) => p.identity),
                            );
                          }
                        }}
                        className="px-2.5 py-1.5 bg-[#222] border border-[#333] rounded-xl"
                      >
                        <Text className="text-gray-300 text-[11px] font-semibold">
                          {selectedUserIdsToAdd.length ===
                            filteredUnassigned.length
                            ? t(
                              "meeting.create_breakout_modal.deselect_all",
                              { defaultValue: "Bỏ chọn" },
                            )
                            : t("meeting.create_breakout_modal.select_all", {
                              defaultValue: "Chọn tất cả",
                            })}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* List of Unassigned */}
                  <ScrollView
                    className="p-2.5 max-h-56"
                    contentContainerStyle={{ paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredUnassigned.length === 0 ? (
                      <Text className="text-center py-6 text-gray-500 text-xs italic">
                        {t(
                          "meeting.create_breakout_modal.no_unassigned_found",
                          {
                            defaultValue:
                              "Không còn người tham gia nào chưa phân công",
                          },
                        )}
                      </Text>
                    ) : (
                      filteredUnassigned.map((p) => {
                        const isSelected = selectedUserIdsToAdd.includes(
                          p.identity,
                        );

                        return (
                          <TouchableOpacity
                            key={p.identity}
                            onPress={() =>
                              handleToggleUserSelection(p.identity)
                            }
                            className={`p-2.5 rounded-xl border mb-2 flex-row items-center justify-between ${isSelected
                              ? "bg-blue-600/15 border-blue-500"
                              : "bg-[#222] border-[#333]"
                              }`}
                          >
                            <View className="flex-row items-center flex-1 mr-2">
                              <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center mr-2">
                                <Text className="text-white text-[10px] font-bold">
                                  {(p.name || p.identity)
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>
                              <Text
                                className="text-xs font-medium text-gray-200 flex-1"
                                numberOfLines={1}
                              >
                                {p.name || p.identity}
                              </Text>
                            </View>

                            <Feather
                              name={isSelected ? "check-square" : "square"}
                              size={16}
                              color={isSelected ? "#60a5fa" : "#64748b"}
                            />
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>

                  {/* Footer */}
                  <View className="p-3 border-t border-[#222] flex-row items-center justify-end bg-[#111]">
                    <TouchableOpacity
                      onPress={() => setAddModalTargetRoomId(null)}
                      className="px-3.5 py-2 rounded-xl mr-2"
                    >
                      <Text className="text-gray-400 text-xs font-semibold">
                        {t("meeting.create_breakout_modal.cancel", {
                          defaultValue: "Huỷ",
                        })}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleConfirmAddUsers}
                      disabled={selectedUserIdsToAdd.length === 0}
                      className={`px-4 py-2 rounded-xl flex-row items-center ${selectedUserIdsToAdd.length === 0
                        ? "bg-blue-600/40 opacity-50"
                        : "bg-blue-600 active:bg-blue-500"
                        }`}
                    >
                      <Feather name="plus" size={13} color="#ffffff" />
                      <Text className="text-white text-xs font-bold ml-1.5">
                        {t("meeting.create_breakout_modal.add_selected", {
                          count: selectedUserIdsToAdd.length,
                          defaultValue: `Thêm (${selectedUserIdsToAdd.length}) thành viên`,
                        })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* ================= OPTIONS / SETTINGS MODAL SHEET ================= */}
            {isSettingsOpen && (
              <View className="absolute inset-0 z-50 bg-black/75 p-4 justify-center items-center">
                <View className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl p-4 flex-col">
                  <View className="flex-row items-center justify-between border-b border-[#222] pb-3 mb-3">
                    <View className="flex-row items-center">
                      <Feather name="settings" size={15} color="#60a5fa" />
                      <Text className="text-white text-xs font-bold ml-2">
                        {t("meeting.create_breakout_modal.options_title", {
                          defaultValue: "Tùy chọn phòng theo nhóm",
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsSettingsOpen(false)}
                      className="p-1 rounded-lg bg-[#222] border border-[#333]"
                    >
                      <Feather name="x" size={15} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  {/* Auto Close Setting */}
                  <View className="mb-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-gray-200 text-xs font-medium flex-1 mr-2">
                        {t(
                          "meeting.create_breakout_modal.auto_close_checkbox",
                          {
                            defaultValue:
                              "Tự động đóng các phòng thảo luận sau",
                          },
                        )}
                      </Text>
                      <Switch
                        value={isAutoCloseEnabled}
                        onValueChange={setIsAutoCloseEnabled}
                        trackColor={{ false: "#333333", true: "#3b82f6" }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {isAutoCloseEnabled && (
                      <View className="flex-row items-center mt-2 bg-[#111] border border-[#333] rounded-xl px-3 py-2">
                        <TextInput
                          value={String(autoCloseMinutes)}
                          onChangeText={(v) =>
                            setAutoCloseMinutes(
                              Math.max(1, Number(v.replace(/[^0-9]/g, ""))),
                            )
                          }
                          keyboardType="number-pad"
                          className="text-white text-xs font-mono font-bold w-12 text-center bg-[#222] border border-[#333] rounded-lg py-1 mr-2"
                        />
                        <Text className="text-gray-400 text-xs">
                          {t("meeting.create_breakout_modal.minutes_unit", {
                            defaultValue: "phút",
                          })}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Status row */}
                  <View className="pt-2.5 border-t border-[#222] flex-row items-center justify-between">
                    <Text className="text-gray-400 text-[11px]">
                      {t("meeting.create_breakout_modal.status_label", {
                        defaultValue: "Trạng thái:",
                      })}
                    </Text>
                    <Text className="text-gray-200 text-[11px] font-semibold">
                      {isAutoCloseEnabled
                        ? t("meeting.create_breakout_modal.time_limit", {
                          count: autoCloseMinutes,
                          defaultValue: `Thời gian: ${autoCloseMinutes} phút`,
                        })
                        : t("meeting.create_breakout_modal.unlimited_time", {
                          defaultValue: "Không giới hạn thời gian",
                        })}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* FOOTER BAR */}
          <View className="px-4 py-3 border-t border-[#222] bg-[#111] flex-row items-center justify-between">
            <View className="flex-row items-center">
              {step === 2 && (
                <>
                  <TouchableOpacity
                    onPress={() => setStep(1)}
                    className="p-2 bg-[#222] border border-[#333] rounded-xl mr-2 flex-row items-center"
                  >
                    <Feather name="arrow-left" size={14} color="#94a3b8" />
                    <Text className="text-gray-300 text-xs font-semibold ml-1.5">
                      {t("meeting.create_breakout_modal.btn_back", {
                        defaultValue: "Quay lại",
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsSettingsOpen(true)}
                    className="p-2 bg-[#222] border border-[#333] rounded-xl flex-row items-center"
                  >
                    <Feather name="settings" size={14} color="#60a5fa" />
                    {isAutoCloseEnabled && (
                      <View className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1.5" />
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={onClose}
                className="px-3.5 py-2 rounded-xl mr-2"
              >
                <Text className="text-gray-400 text-xs font-semibold">
                  {t("meeting.create_breakout_modal.cancel", {
                    defaultValue: "Huỷ",
                  })}
                </Text>
              </TouchableOpacity>

              {step === 1 ? (
                <TouchableOpacity
                  onPress={handleProceedToStep2}
                  className="px-4 py-2 bg-blue-600 rounded-xl flex-row items-center active:bg-blue-500"
                >
                  <Text className="text-white text-xs font-bold mr-1.5">
                    {t("meeting.create_breakout_modal.btn_next", {
                      defaultValue: "Tiếp tục",
                    })}
                  </Text>
                  <Feather name="arrow-right" size={14} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isLoading}
                  className={`px-4 py-2 bg-blue-600 rounded-xl flex-row items-center ${isLoading ? "opacity-60" : "active:bg-blue-500"
                    }`}
                >
                  {isLoading && (
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text className="text-white text-xs font-bold">
                    {t("meeting.create_breakout_modal.start_breakout", {
                      defaultValue: "Mở tất cả phòng",
                    })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
