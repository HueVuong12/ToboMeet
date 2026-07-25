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
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useParticipantManager } from "../../hooks/useParticipantManager";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const {
    localParticipant,
    displayParticipants,
    isLocalAdmin,
    kickingUserId,
    renameState,
    setRenameState,
    handleRemove,
    handleRenameSubmit,
    handleMute,
    getHandState,
  } = useParticipantManager({ roomId, channelId, meetingCode });

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
          paddingTop: Math.max(insets.top, 20), // Đẩy xuống khỏi tai thỏ/camera đục lỗ
          paddingBottom: Math.max(insets.bottom, 20), // Đẩy lên khỏi phím điều hướng
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
            backgroundColor: "#111",
            height: "75%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            borderTopWidth: 1,
            borderColor: "#333",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 15,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#222",
            }}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
              Thành viên
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
              marginBottom: 5,
            }}
          >
            <Text
              style={{
                color: "#9ca3af",
                fontSize: 12,
                fontWeight: "bold",
                textTransform: "uppercase",
              }}
            >
              Đang tham gia
            </Text>
            <View
              style={{
                backgroundColor: "#222",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#333",
              }}
            >
              <Text
                style={{ color: "#d1d5db", fontSize: 12, fontWeight: "bold" }}
              >
                {displayParticipants.length} người
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
                          backgroundColor: "#222",
                          borderWidth: 1,
                          borderColor: "#333",
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
                        right: 30,
                        top: 40,
                        backgroundColor: "#222",
                        borderRadius: 12,
                        padding: 4,
                        borderWidth: 1,
                        borderColor: "#333",
                        zIndex: 999,
                      }}
                    >
                      {/* Nút Đổi Tên */}
                      {isMe && (
                        <TouchableOpacity
                          onPress={() => {
                            setRenameState({
                              isOpen: true,
                              newName: p.name || "",
                            });
                            setOpenActionId(null);
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            gap: 10,
                          }}
                        >
                          <Feather name="edit-2" size={16} color="white" />
                          <Text style={{ color: "white", fontSize: 14 }}>
                            Đổi tên
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Các Nút Admin */}
                      {isLocalAdmin && !isMe && (
                        <>
                          {/* Nút Tắt Mic */}
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
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                gap: 10,
                              }}
                            >
                              <Feather name="mic-off" size={16} color="white" />
                              <Text style={{ color: "white", fontSize: 14 }}>
                                Tắt Mic
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Nút Tắt Cam */}
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
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                gap: 10,
                              }}
                            >
                              <Feather
                                name="video-off"
                                size={16}
                                color="white"
                              />
                              <Text style={{ color: "white", fontSize: 14 }}>
                                Tắt Camera
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Phân cách UI */}
                          {(p.isMicrophoneEnabled || p.isCameraEnabled) && (
                            <View
                              style={{
                                height: 1,
                                backgroundColor: "rgba(255,255,255,0.1)",
                                marginHorizontal: 8,
                              }}
                            />
                          )}

                          {/* Nút Đuổi */}
                          <TouchableOpacity
                            onPress={() => {
                              handleRemove(p);
                              setOpenActionId(null);
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 12,
                              paddingHorizontal: 16,
                              gap: 10,
                            }}
                          >
                            <Feather
                              name="user-minus"
                              size={16}
                              color="#ef4444"
                            />
                            <Text style={{ color: "#ef4444", fontSize: 14 }}>
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
                backgroundColor: "#111",
                width: "100%",
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: "#333",
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
                placeholderTextColor="#6b7280"
                style={{
                  backgroundColor: "#222",
                  color: "#d1d5db",
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: "#333",
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
