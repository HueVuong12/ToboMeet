import React, { useState, useEffect } from "react";
import {
  Modal,
  Image,
  View,
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useParticipantManager } from "../../hooks/useParticipantManager";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

export default function MembersModal({
  visible,
  onClose,
  meetingCode,
}: {
  visible: boolean;
  onClose: () => void;
  meetingCode: string;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const [activeListTab, setActiveListTab] = useState<"joined" | "waiting">(
    "joined",
  );

  const {
    localParticipant,
    displayParticipants,
    waitingParticipants,
    canApprove,
    isLocalOwner,
    canManageParticipants,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    handleMute,
    handleTransferOwnership,
    handleUpdateRole,
    handleApprove,
    getHandState,
    isRenaming,
  } = useParticipantManager({ meetingCode });

  useEffect(() => {
    if (!canApprove && activeListTab === "waiting") {
      setActiveListTab("joined");
    }
  }, [canApprove, activeListTab]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        className="flex-1 justify-end bg-black/50"
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

        {/* Khung Modal Thành Viên */}
        <View className="bg-[#111] h-[75%] rounded-t-3xl p-5 border-t border-[#333]">
          {/* Drag Handle */}
          <View className="w-10 h-1 bg-[#444] rounded-full self-center mb-3" />

          <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-[#222]">
            <Text className="text-white text-base font-bold">
              {t("meeting.member_modal.members_modal_title", {
                defaultValue: "Thành viên",
              })}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-1.5 rounded-lg bg-[#222] border border-[#333]"
            >
              <Feather name="x" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* ================= THANH ĐIỀU HƯỚNG TABS ================= */}
          {canApprove && (
            <View className="flex-row bg-[#1a1a1a] rounded-xl p-1 mb-3 border border-[#333]">
              <TouchableOpacity
                onPress={() => setActiveListTab("joined")}
                className={`flex-1 py-2 rounded-lg items-center ${
                  activeListTab === "joined" ? "bg-[#333]" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    activeListTab === "joined" ? "text-white" : "text-gray-400"
                  }`}
                >
                  {t("meeting.member_modal.joined_count", {
                    count: displayParticipants.length,
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveListTab("waiting")}
                className={`flex-1 py-2 rounded-lg items-center ${
                  activeListTab === "waiting" ? "bg-[#333]" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    activeListTab === "waiting" ? "text-white" : "text-gray-400"
                  }`}
                >
                  {t("meeting.member_modal.waiting_count", {
                    count: waitingParticipants.length,
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= HEADER SỐ LƯỢNG NGƯỜI ================= */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              {activeListTab === "waiting"
                ? `${t("meeting.member_modal.waiting_label")} (${waitingParticipants.length})`
                : `${t("meeting.member_modal.joined_label")} (${displayParticipants.length})`}
            </Text>

            {activeListTab === "waiting" && waitingParticipants.length > 0 && (
              <TouchableOpacity
                onPress={() => handleApprove("all")}
                className="bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg"
              >
                <Text className="text-amber-400 text-xs font-bold">
                  {t("meeting.member_modal.approve_all")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ================= KHU VỰC PHÒNG CHỜ VÀ PHÒNG CHÍNH ================= */}
          {activeListTab === "waiting" && waitingParticipants.length === 0 ? (
            <View className="flex-1 justify-center items-center opacity-60">
              <Feather
                name="clock"
                size={36}
                color="#64748b"
                className="mb-2.5"
              />
              <Text className="text-gray-400 text-xs font-medium">
                {t("meeting.member_modal.waiting_empty")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={
                activeListTab === "waiting"
                  ? waitingParticipants
                  : displayParticipants
              }
              keyExtractor={(p) => p.identity}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: p }) => {
                const isMe = p.identity === localParticipant.identity;
                const isMuted = !p.isMicrophoneEnabled;
                const showMenuButton = isMe || canManageParticipants;
                const { isRaised } = getHandState(p);

                let avatarUrl = "";
                let role = "member";
                try {
                  if (p.metadata) {
                    const meta = JSON.parse(p.metadata);
                    avatarUrl = meta.avatarUrl;
                    role = meta.role || "guest";
                  }
                } catch (e) {
                  console.error("Lỗi parse metadata:", e);
                }

                // Xác định text chức danh hiển thị dựa theo roomType
                let roleText = "";
                if (role === "owner") {
                  roleText = t("meeting.member_modal.role_leader", {
                    defaultValue: "Trưởng nhóm",
                  });
                } else if (role === "admin") {
                  roleText = t("meeting.member_modal.role_vice_leader", {
                    defaultValue: "Phó nhóm",
                  });
                } else if (role === "guest") {
                  roleText = "Người ngoài";
                }

                return (
                  <View className="flex-row items-center py-2.5 gap-2.5">
                    {/* Avatar */}
                    <View className="relative">
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          className="w-9 h-9 rounded-full border border-[#333] bg-[#222]"
                        />
                      ) : (
                        <View className="w-9 h-9 rounded-full bg-blue-600 justify-center items-center shadow-sm">
                          <Text className="text-white font-bold text-xs uppercase">
                            {p.name?.charAt(0).toUpperCase() || "?"}
                          </Text>
                        </View>
                      )}
                      {activeListTab === "joined" && (
                        <View className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#111]" />
                      )}
                    </View>

                    {/* Info */}
                    <View className="flex-1 justify-center">
                      <Text
                        className="text-slate-200 text-sm font-semibold"
                        numberOfLines={1}
                      >
                        {p.name}
                        {isMe && (
                          <Text className="text-slate-500 font-normal">
                            {" "}
                            {t("meeting.member_modal.you_label")}
                          </Text>
                        )}
                      </Text>
                      {activeListTab === "joined" ? (
                        role !== "member" && (
                          <Text className="text-[10px] font-medium mt-0.5 text-blue-400">
                            {roleText}
                          </Text>
                        )
                      ) : (
                        <Text className="text-amber-400 text-[10px] font-medium mt-0.5">
                          {t("meeting.member_modal.requesting_access")}
                        </Text>
                      )}
                    </View>

                    {/* Actions */}
                    {activeListTab === "waiting" ? (
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() =>
                            handleRemove(p.identity, p.name || "Người dùng")
                          }
                          className="p-2 bg-red-500/15 border border-red-500/20 rounded-lg"
                        >
                          <Feather
                            name="user-minus"
                            size={14}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleApprove(p.identity)}
                          className="p-2 bg-amber-500/15 border border-amber-500/20 rounded-lg"
                        >
                          <Feather name="check" size={14} color="#f59e0b" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1.5">
                        {isRaised && (
                          <Ionicons
                            name="hand-left"
                            size={13}
                            color="#fbbf24"
                          />
                        )}

                        <View
                          className={`p-1.5 rounded-lg border ${isMuted ? "bg-red-500/10 border-red-500/20" : "bg-[#222] border-[#333]"}`}
                        >
                          <Feather
                            name={isMuted ? "mic-off" : "mic"}
                            size={13}
                            color={isMuted ? "#ef4444" : "#60a5fa"}
                          />
                        </View>

                        {kickingUserId === p.identity ? (
                          <ActivityIndicator
                            size="small"
                            color="#ef4444"
                            className="p-1"
                          />
                        ) : (
                          showMenuButton && (
                            <TouchableOpacity
                              onPress={() =>
                                setOpenActionId(
                                  openActionId === p.identity
                                    ? null
                                    : p.identity,
                                )
                              }
                              className="p-1.5 rounded-lg bg-[#222] border border-[#333]"
                            >
                              <Feather
                                name="more-vertical"
                                size={14}
                                color="#94a3b8"
                              />
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    )}

                    {/* Dropdown Menu (Chỉ hiện khi ở tab Joined) */}
                    {activeListTab === "joined" &&
                      openActionId === p.identity && (
                        <View className="absolute right-6 top-10 bg-[#1c1c1c] rounded-xl p-1 border border-[#333] z-50 shadow-2xl">
                          {isMe && (
                            <TouchableOpacity
                              onPress={() => {
                                setRenameState({
                                  isOpen: true,
                                  newName: p.name || "",
                                });
                                setOpenActionId(null);
                              }}
                              className="flex-row items-center py-2.5 px-3.5 gap-2.5"
                            >
                              <Feather name="edit-2" size={14} color="#60a5fa" />
                              <Text className="text-white text-xs font-medium">
                                {t("meeting.member_modal.rename_title")}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* MENU DÀNH CHO OWNER (ĐỔI QUYỀN / CHUYỂN QUYỀN) */}
                          {isLocalOwner && !isMe && role !== "guest" && (
                            <>
                              {role === "admin" ? (
                                <TouchableOpacity
                                  onPress={() => {
                                    handleUpdateRole(p.identity, "member");
                                    setOpenActionId(null);
                                  }}
                                  className="flex-row items-center py-2.5 px-3.5 gap-2.5"
                                >
                                  <Feather
                                    name="user-check"
                                    size={14}
                                    color="#94a3b8"
                                  />
                                  <Text className="text-white text-xs font-medium">
                                    {t(
                                      "meeting.member_modal.revoke_vice_leader",
                                      {
                                        defaultValue: "Thu hồi phó nhóm",
                                      },
                                    )}
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => {
                                    handleUpdateRole(p.identity, "admin");
                                    setOpenActionId(null);
                                  }}
                                  className="flex-row items-center py-2.5 px-3.5 gap-2.5"
                                >
                                  <Feather
                                    name="user-check"
                                    size={14}
                                    color="#60a5fa"
                                  />
                                  <Text className="text-white text-xs font-medium">
                                    {t(
                                      "meeting.member_modal.appoint_vice_leader",
                                      {
                                        defaultValue: "Bổ nhiệm Phó nhóm",
                                      },
                                    )}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                onPress={() => {
                                  handleTransferOwnership(
                                    p.identity,
                                    p.name || "Thành viên",
                                  );
                                  setOpenActionId(null);
                                }}
                                className="flex-row items-center py-2.5 px-3.5 gap-2.5 border-t border-[#333]"
                              >
                                <Feather
                                  name="shield"
                                  size={14}
                                  color="#fbbf24"
                                />
                                <Text className="text-white text-xs font-medium">
                                  {t("meeting.member_modal.appoint_leader", {
                                    defaultValue: "Bổ nhiệm Trưởng nhóm",
                                  })}
                                </Text>
                              </TouchableOpacity>

                              <View className="h-[1px] bg-[#333] mx-2" />
                            </>
                          )}

                          {canManageParticipants && !isMe && (
                            <>
                              {p.isMicrophoneEnabled && (
                                <TouchableOpacity
                                  onPress={() => {
                                    handleMute(
                                      p.identity,
                                      p.name || "Thành viên",
                                      "audio",
                                    );
                                    setOpenActionId(null);
                                  }}
                                  className="flex-row items-center py-2.5 px-3.5 gap-2.5"
                                >
                                  <Feather
                                    name="mic-off"
                                    size={14}
                                    color="#94a3b8"
                                  />
                                  <Text className="text-white text-xs font-medium">
                                    {t("meeting.member_modal.mute_mic")}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {p.isCameraEnabled && (
                                <TouchableOpacity
                                  onPress={() => {
                                    handleMute(
                                      p.identity,
                                      p.name || "Thành viên",
                                      "video",
                                    );
                                    setOpenActionId(null);
                                  }}
                                  className="flex-row items-center py-2.5 px-3.5 gap-2.5"
                                >
                                  <Feather
                                    name="video-off"
                                    size={14}
                                    color="#94a3b8"
                                  />
                                  <Text className="text-white text-xs font-medium">
                                    {t("meeting.member_modal.mute_cam")}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {(p.isMicrophoneEnabled || p.isCameraEnabled) && (
                                <View className="h-[1px] bg-[#333] mx-2" />
                              )}

                              <TouchableOpacity
                                onPress={() => {
                                  handleRemove(
                                    p.identity,
                                    p.name || "Người dùng",
                                  );
                                  setOpenActionId(null);
                                }}
                                className="flex-row items-center py-2.5 px-3.5 gap-2.5"
                              >
                                <Feather
                                  name="user-minus"
                                  size={14}
                                  color="#ef4444"
                                />
                                <Text className="text-red-400 text-xs font-medium">
                                  {t(
                                    "meeting.member_modal.remove_from_meeting",
                                  )}
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>

      {/* Modal đổi tên */}
      {renameState?.isOpen && (
        <Modal visible transparent animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/60 p-5">
            <View className="bg-[#1c1c1c] w-full max-w-sm rounded-2xl p-5 border border-[#333] shadow-2xl">
              <Text className="text-white text-base font-bold mb-3">
                {t("meeting.member_modal.rename_title")}
              </Text>

              <TextInput
                value={renameState.newName}
                onChangeText={(text) =>
                  setRenameState({ ...renameState, newName: text })
                }
                editable={!isRenaming}
                placeholder={t("meeting.member_modal.rename_placeholder")}
                placeholderTextColor="#64748b"
                className="bg-[#222] text-white px-3.5 py-2.5 rounded-xl text-sm mb-4 border border-[#333] focus:border-blue-500"
                autoFocus
              />

              <View className="flex-row justify-end gap-2.5">
                <TouchableOpacity
                  onPress={() => setRenameState(null)}
                  disabled={isRenaming}
                  className="py-2 px-3.5 rounded-lg bg-[#222] border border-[#333]"
                >
                  <Text className="text-slate-300 font-semibold text-xs">
                    {t("meeting.member_modal.rename_cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRenameSubmit}
                  disabled={!renameState.newName.trim() || isRenaming}
                  className={`py-2 px-4 rounded-lg shadow-md flex-row items-center gap-1.5 ${
                    renameState.newName.trim() && !isRenaming
                      ? "bg-blue-600 active:bg-blue-500"
                      : "bg-[#333]"
                  }`}
                >
                  {isRenaming && (
                    <ActivityIndicator size="small" color="#ffffff" />
                  )}
                  <Text className="text-white font-bold text-xs">
                    {t("meeting.member_modal.rename_save")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}
