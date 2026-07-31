import React, { useState } from "react";
import {
  Modal,
  Image,
  View,
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { toast } from "../../lib/toast";
import { useRemoveParticipantMutation } from "../../lib/redux/features/rooms/roomsApi";
import { useHandRaise } from "../../hooks/useHandRaise";
import { Participant } from "livekit-client";

// COMPONENT: DANH SÁCH THÀNH VIÊN (BOTTOM SHEET)
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
  const { t } = useTranslation();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { getHandState } = useHandRaise();

  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [kickedUsers, setKickedUsers] = useState<string[]>([]);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{
    isOpen: boolean;
    newName: string;
  } | null>(null);

  const [removeParticipant] = useRemoveParticipantMutation();

  // Kiểm tra quyền của bản thân (Admin/Owner)
  let localRole = "member";
  try {
    if (localParticipant.metadata) {
      localRole = JSON.parse(localParticipant.metadata).role || "member";
    }
  } catch (e) {
    console.error(e);
  }
  const isLocalAdmin = localRole === "owner" || localRole === "admin";

  // Lọc những người bị kick và sắp xếp thứ tự giơ tay
  const displayParticipants = participants
    .filter((p) => !kickedUsers.includes(p.identity))
    .sort((a, b) => {
      const stateA = getHandState(a);
      const stateB = getHandState(b);

      if (stateA.isRaised && stateB.isRaised) {
        return parseInt(stateA.raisedAt) - parseInt(stateB.raisedAt);
      }
      if (stateA.isRaised) return -1;
      if (stateB.isRaised) return 1;
      return 0;
    });

  // Hàm xử lý Kick
  const handleRemove = (participant: Participant) => {
    Alert.alert(
      "Xác nhận",
      `Bạn có chắc chắn muốn đuổi ${participant.name} khỏi cuộc họp?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đuổi",
          style: "destructive",
          onPress: async () => {
            setOpenActionId(null);
            setKickingUserId(participant.identity);
            try {
              await removeParticipant({
                roomId,
                channelId,
                code: meetingCode,
                identity: participant.identity,
              }).unwrap();
              // Đưa vào danh sách ẩn ngay lập tức
              setKickedUsers((prev) => [...prev, participant.identity]);

              setTimeout(() => {
                setKickedUsers((prev) =>
                  prev.filter((id) => id !== participant.identity),
                );
              }, 3000);
            } catch (error) {
              Alert.alert(
                "Lỗi",
                "Không thể thực hiện thao tác đuổi khỏi phòng!",
              );
              console.error(error);
            } finally {
              setKickingUserId(null);
            }
          },
        },
      ],
    );
  };

  // Hàm xử lý Đổi tên
  const handleRenameSubmit = async () => {
    if (!renameState || !renameState.newName.trim()) return;
    try {
      await localParticipant.setName(renameState.newName.trim());
      setRenameState(null);
    } catch (error) {
      console.error(error);
      toast.error("Không thể đổi tên lúc này!");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{ flex: 1 }}
        />

        {/* Khung Modal Thành Viên */}
        <View
          style={{
            backgroundColor: "#1e293b",
            height: "75%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            borderTopWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.05)",
            }}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
              {t("meeting_modal.title", { defaultValue: "Thành viên" })}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Feather name="x" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: "#94a3b8",
                fontSize: 12,
                fontWeight: "bold",
                textTransform: "uppercase",
              }}
            >
              {t("meeting_modal.joining", { defaultValue: "Đang tham gia" })}
            </Text>
            <View
              style={{
                backgroundColor: "#334155",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text
                style={{ color: "#e2e8f0", fontSize: 12, fontWeight: "bold" }}
              >
                {t("meeting_modal.people_count", { count: displayParticipants.length, defaultValue: `${displayParticipants.length} người` })}
              </Text>
            </View>
          </View>

          <FlatList
            data={displayParticipants}
            keyExtractor={(p) => p.identity}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: p }) => {
              const isMe = p.identity === localParticipant.identity;
              const isMuted = !p.isMicrophoneEnabled;
              const showMenuButton = isMe || isLocalAdmin; // Chỉ hiện 3 chấm nếu là mình hoặc là Admin
              const { isRaised } = getHandState(p);

              let avatarUrl = "";
              let role = "member";
              try {
                if (p.metadata) {
                  const meta = JSON.parse(p.metadata);
                  avatarUrl = meta.avatarUrl;
                  role = meta.role || "member";
                }
              } catch (e) {
                console.error("Lỗi parse metadata:", e);
              }

              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    gap: 12,
                  }}
                >
                  {/* Avatar */}
                  <View style={{ position: "relative" }}>
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "rgba(59, 130, 246, 0.2)",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#60a5fa",
                            fontWeight: "bold",
                            fontSize: 16,
                          }}
                        >
                          {p.name?.charAt(0).toUpperCase() || "?"}
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        backgroundColor: "#22c55e",
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: "#1e293b",
                      }}
                    />
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text
                      style={{
                        color: "#e2e8f0",
                        fontSize: 15,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {p.name}
                      {isMe && (
                        <Text style={{ color: "#64748b", fontWeight: "400" }}>
                          {" "}
                          (Bạn)
                        </Text>
                      )}
                    </Text>
                    {role !== "member" && (
                      <Text
                        style={{
                          color: role === "owner" ? "#fbbf24" : "#60a5fa",
                          fontSize: 10,
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          marginTop: 2,
                        }}
                      >
                        {role === "owner" ? "Chủ phòng" : "Quản trị viên"}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {/* HIỆN ICON BÀN TAY NẾU ĐANG GIƠ TAY */}
                    {isRaised && (
                      <Ionicons name="hand-left" size={14} color="#fbbf24" />
                    )}

                    <View
                      style={{
                        padding: 6,
                        borderRadius: 8,
                        backgroundColor: isMuted
                          ? "rgba(239, 68, 68, 0.1)"
                          : "transparent",
                      }}
                    >
                      <Feather
                        name={isMuted ? "mic-off" : "mic"}
                        size={14}
                        color={isMuted ? "#ef4444" : "#94a3b8"}
                      />
                    </View>

                    {/* Nút 3 chấm / Loading Spinner */}
                    {kickingUserId === p.identity ? (
                      <ActivityIndicator
                        size="small"
                        color="#ef4444"
                        style={{ padding: 4 }}
                      />
                    ) : (
                      showMenuButton && (
                        <TouchableOpacity
                          onPress={() =>
                            setOpenActionId(
                              openActionId === p.identity ? null : p.identity,
                            )
                          }
                          style={{ padding: 8 }}
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

                  {/* Dropdown Menu */}
                  {openActionId === p.identity && (
                    <View
                      style={{
                        position: "absolute",
                        right: 40,
                        top: 35,
                        backgroundColor: "#0f172a",
                        borderRadius: 12,
                        padding: 4,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                        zIndex: 10,
                      }}
                    >
                      {/* Nút Đổi Tên (Chỉ hiện nếu là mình) */}
                      {isMe && (
                        <TouchableOpacity
                          onPress={() => {
                            setRenameState({
                              isOpen: true,
                              newName: p.name || "",
                            });
                            setOpenActionId(null);
                          }}
                          style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                        >
                          <Text style={{ color: "white", fontSize: 14 }}>
                            Đổi tên
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Nút Đuổi (Chỉ hiện nếu là Admin và không phải đang tự bấm vào mình) */}
                      {isLocalAdmin && !isMe && (
                        <TouchableOpacity
                          onPress={() => handleRemove(p)}
                          style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                        >
                          <Text style={{ color: "#ef4444", fontSize: 14 }}>
                            Đuổi khỏi phòng
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />
        </View>
      </View>

      {/* ==========================================
          MODAL ĐỔI TÊN NỔI LÊN TRÊN CÙNG
      ========================================== */}
      {renameState?.isOpen && (
        <Modal visible transparent animationType="fade">
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.6)",
              padding: 20,
            }}
          >
            <View
              style={{
                backgroundColor: "#1e293b",
                width: "100%",
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 16,
                }}
              >
                Đổi tên hiển thị
              </Text>

              <TextInput
                value={renameState.newName}
                onChangeText={(text) =>
                  setRenameState({ ...renameState, newName: text })
                }
                placeholder="Nhập tên mới..."
                placeholderTextColor="#64748b"
                style={{
                  backgroundColor: "#0f172a",
                  color: "white",
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: "#334155",
                }}
                autoFocus
              />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setRenameState(null)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: "#94a3b8", fontWeight: "bold" }}>
                    Hủy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRenameSubmit}
                  disabled={!renameState.newName.trim()}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    backgroundColor: renameState.newName.trim()
                      ? "#3b82f6"
                      : "#1e40af",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    Lưu thay đổi
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
