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
import { useRoomSettings } from "../../hooks/useRoomSettings";

export default function MembersModal({
  visible,
  onClose,
  roomId,
  channelId,
  meetingCode,
}: {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  channelId: string;
  meetingCode: string;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const [activeListTab, setActiveListTab] = useState<"joined" | "waiting">(
    "joined",
  );

  const { roomType } = useRoomSettings({ meetingCode });

  const {
    localParticipant,
    displayParticipants,
    waitingParticipants,
    canApprove,
    isLocalAdmin,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    handleMute,
    handleApprove,
    getHandState,
  } = useParticipantManager({ roomId, channelId, meetingCode });

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
          <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-[#222]">
            <Text className="text-white text-lg font-bold">
              {t("meeting_modal.title", { defaultValue: "Thành viên" })}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* ================= THANH ĐIỀU HƯỚNG TABS ================= */}
          {canApprove && (
            <View className="flex-row bg-[#1a1a1a] rounded-xl p-1 mb-4 border border-[#333]">
              <TouchableOpacity
                onPress={() => setActiveListTab("joined")}
                className={`flex-1 py-2.5 rounded-lg items-center ${
                  activeListTab === "joined" ? "bg-[#333]" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-[13px] font-semibold ${
                    activeListTab === "joined" ? "text-white" : "text-gray-400"
                  }`}
                >
                  Đã tham gia ({displayParticipants.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveListTab("waiting")}
                className={`flex-1 py-2.5 rounded-lg items-center ${
                  activeListTab === "waiting" ? "bg-[#333]" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-[13px] font-semibold ${
                    activeListTab === "waiting" ? "text-white" : "text-gray-400"
                  }`}
                >
                  Chờ duyệt{" "}
                  {waitingParticipants.length > 0
                    ? `(${waitingParticipants.length})`
                    : ""}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= HEADER SỐ LƯỢNG NGƯỜI ================= */}
          <View className="flex-row justify-between items-center mb-2.5">
            <Text className="text-gray-400 text-xs font-bold uppercase">
              {activeListTab === "waiting"
                ? "Đang chờ vào phòng"
                : "Đang tham gia"}
            </Text>

            {activeListTab === "waiting" && waitingParticipants.length > 0 ? (
              <TouchableOpacity
                onPress={() => handleApprove("all", "Tất cả")}
                className="bg-amber-500/15 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-amber-500 text-xs font-bold">
                  Duyệt tất cả
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-[#222] px-2.5 py-1 rounded-xl border border-[#333]">
                <Text className="text-gray-300 text-xs font-bold">
                  {activeListTab === "waiting"
                    ? waitingParticipants.length
                    : displayParticipants.length}{" "}
                  người
                </Text>
              </View>
            )}
          </View>

          {/* ================= KHU VỰC PHÒNG CHỜ VÀ PHÒNG CHÍNH ================= */}
          {activeListTab === "waiting" && waitingParticipants.length === 0 ? (
            <View className="flex-1 justify-center items-center opacity-60">
              <Feather
                name="clock"
                size={40}
                color="#64748b"
                className="mb-3"
              />
              <Text className="text-gray-400 text-sm">
                Không có ai ở phòng chờ
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
                const showMenuButton = isMe || isLocalAdmin;
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
                  roleText =
                    roomType === "classroom" ? "Giảng viên" : "Chủ phòng";
                } else if (role === "admin") {
                  roleText =
                    roomType === "classroom" ? "Ban cán sự" : "Phó phòng";
                } else if (role === "guest") {
                  roleText = "Người ngoài";
                }

                return (
                  <View className="flex-row items-center py-3 gap-3">
                    {/* Avatar */}
                    <View className="relative">
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <View className="w-10 h-10 rounded-full bg-[#222] border border-[#333] justify-center items-center">
                          <Text className="text-blue-400 font-bold text-base">
                            {p.name?.charAt(0).toUpperCase() || "?"}
                          </Text>
                        </View>
                      )}
                      {activeListTab === "joined" && (
                        <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800" />
                      )}
                    </View>

                    {/* Info */}
                    <View className="flex-1 justify-center">
                      <Text
                        className="text-slate-200 text-[15px] font-semibold"
                        numberOfLines={1}
                      >
                        {p.name}
                        {isMe && (
                          <Text className="text-slate-500 font-normal">
                            {" "}
                            (Bạn)
                          </Text>
                        )}
                      </Text>
                      {activeListTab === "joined" ? (
                        role !== "member" && (
                          <Text className="text-[11px] font-semibold mt-0.5 text-slate-400">
                            {roleText}
                          </Text>
                        )
                      ) : (
                        <Text className="text-amber-500 text-[11px] mt-0.5">
                          Đang yêu cầu tham gia...
                        </Text>
                      )}
                    </View>

                    {/* Actions */}
                    {activeListTab === "waiting" ? (
                      <View className="flex-row gap-2.5">
                        <TouchableOpacity
                          onPress={() => handleRemove(p)}
                          className="p-2 bg-red-500/15 rounded-lg"
                        >
                          <Feather
                            name="user-minus"
                            size={16}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            handleApprove(p.identity, p.name || "Người dùng")
                          }
                          className="p-2 bg-amber-500/15 rounded-lg"
                        >
                          <Feather name="check" size={16} color="#f59e0b" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-2">
                        {isRaised && (
                          <Ionicons
                            name="hand-left"
                            size={14}
                            color="#fbbf24"
                          />
                        )}

                        <View
                          className={`p-1.5 rounded-lg ${isMuted ? "bg-red-500/10" : "bg-transparent"}`}
                        >
                          <Feather
                            name={isMuted ? "mic-off" : "mic"}
                            size={14}
                            color={isMuted ? "#ef4444" : "#94a3b8"}
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
                              className="p-2"
                            >
                              <Feather
                                name="more-vertical"
                                size={16}
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
                        <View className="absolute right-8 top-10 bg-[#222] rounded-xl p-1 border border-[#333] z-50">
                          {isMe && (
                            <TouchableOpacity
                              onPress={() => {
                                setRenameState({
                                  isOpen: true,
                                  newName: p.name || "",
                                });
                                setOpenActionId(null);
                              }}
                              className="flex-row items-center py-3 px-4 gap-2.5"
                            >
                              <Feather name="edit-2" size={16} color="white" />
                              <Text className="text-white text-sm">
                                Đổi tên
                              </Text>
                            </TouchableOpacity>
                          )}

                          {isLocalAdmin && !isMe && (
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
                                  className="flex-row items-center py-3 px-4 gap-2.5"
                                >
                                  <Feather
                                    name="mic-off"
                                    size={16}
                                    color="white"
                                  />
                                  <Text className="text-white text-sm">
                                    Tắt Mic
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
                                  className="flex-row items-center py-3 px-4 gap-2.5"
                                >
                                  <Feather
                                    name="video-off"
                                    size={16}
                                    color="white"
                                  />
                                  <Text className="text-white text-sm">
                                    Tắt Camera
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {(p.isMicrophoneEnabled || p.isCameraEnabled) && (
                                <View className="h-[1px] bg-white/10 mx-2" />
                              )}

                              <TouchableOpacity
                                onPress={() => {
                                  handleRemove(p);
                                  setOpenActionId(null);
                                }}
                                className="flex-row items-center py-3 px-4 gap-2.5"
                              >
                                <Feather
                                  name="user-minus"
                                  size={16}
                                  color="#ef4444"
                                />
                                <Text className="text-red-500 text-sm">
                                  Đuổi khỏi phòng
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
            <View className="bg-[#111] w-full rounded-3xl p-6 border border-[#333]">
              <Text className="text-white text-lg font-bold mb-4">
                Đổi tên hiển thị
              </Text>

              <TextInput
                value={renameState.newName}
                onChangeText={(text) =>
                  setRenameState({ ...renameState, newName: text })
                }
                placeholder="Nhập tên mới..."
                placeholderTextColor="#6b7280"
                className="bg-[#222] text-gray-300 p-4 rounded-xl text-base mb-6 border border-[#333]"
                autoFocus
              />

              <View className="flex-row justify-end gap-3">
                <TouchableOpacity
                  onPress={() => setRenameState(null)}
                  className="py-3 px-5 rounded-xl"
                >
                  <Text className="text-slate-400 font-bold">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRenameSubmit}
                  disabled={!renameState.newName.trim()}
                  className={`py-3 px-5 rounded-xl ${
                    renameState.newName.trim() ? "bg-blue-500" : "bg-blue-900"
                  }`}
                >
                  <Text className="text-white font-bold">Lưu thay đổi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}
