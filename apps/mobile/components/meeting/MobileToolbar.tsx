import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  Text,
  Modal,
  ScrollView,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useRoomContext, useLocalParticipant } from "@livekit/react-native";
import { toast } from "../../lib/toast";
import { useHandRaise } from "../../hooks/useHandRaise";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoomSettings } from "../../hooks/useRoomSettings";

export default function MobileToolbar({
  initialFacingMode,
  roomId,
  channelId,
  meetingCode,
  onOpenMembers,
  onOpenChat,
}: {
  initialFacingMode?: "user" | "environment";
  roomId: string;
  channelId: string;
  meetingCode: string;
  onOpenMembers: () => void;
  onOpenChat: () => void;
}) {
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();
  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();

  const {
    isHost,
    isChatEnabled,
    isWaitingRoomEnabled,
    approvalPermission,
    handleToggleChat,
    handleToggleWaitingRoom,
    handleUpdateApprovalPermission,
  } = useRoomSettings({
    roomId,
    channelId,
    meetingCode,
  });

  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    initialFacingMode || "user",
  );

  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [isApprovalSubmenuOpen, setIsApprovalSubmenuOpen] = useState(false); // Quản lý mở/đóng submenu quyền duyệt

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  const handleFlipCamera = async () => {
    const trackPublication = localParticipant.videoTrackPublications
      .values()
      .next().value;

    if (trackPublication?.videoTrack) {
      const videoTrack = trackPublication.videoTrack;
      const newFacingMode = facingMode === "user" ? "environment" : "user";

      try {
        await videoTrack.restartTrack({ facingMode: newFacingMode });
        setFacingMode(newFacingMode);
      } catch (error) {
        console.error(error);
        toast.error("Không thể lật Camera lúc này.");
      }
    }
  };

  // Helper render style nút: Tràn viền, không bo góc, căn giữa icon và text
  const getBtnStyle = () => ({
    minWidth: 60,
    height: 56, // Tương đương h-14 trên web
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "transparent",
  });

  // UI Component: Nút Switch tùy chỉnh để giống với giao diện Web
  const CustomSwitch = ({ value }: { value: boolean }) => (
    <View
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? "#10b981" : "#4b5563",
        justifyContent: "center",
        paddingHorizontal: 2,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#fff",
          alignSelf: value ? "flex-end" : "flex-start",
        }}
      />
    </View>
  );

  return (
    <>
      <View
        style={{
          backgroundColor: "#111", // Nền đen tuyền đồng bộ web
          borderTopWidth: 1,
          borderTopColor: "#333",
          height: 56,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: "center",
            paddingHorizontal: 0, // Bỏ padding để nút sát viền
            paddingVertical: 0,
            gap: 0, // Bỏ gap để các nút sát mí nhau
          }}
        >
          {/* Nút Camera */}
          <TouchableOpacity onPress={toggleCam} style={getBtnStyle()}>
            <Feather
              name={isCameraEnabled ? "video" : "video-off"}
              size={20}
              color={isCameraEnabled ? "#d1d5db" : "#ef4444"}
            />
            <Text
              style={{
                color: isCameraEnabled ? "#d1d5db" : "#ef4444",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "500",
              }}
            >
              Camera
            </Text>
          </TouchableOpacity>

          {/* Nút Lật Camera (Chỉ có trên mobile) */}
          <TouchableOpacity
            onPress={handleFlipCamera}
            disabled={!isCameraEnabled}
            style={{ ...getBtnStyle(), opacity: isCameraEnabled ? 1 : 0.4 }}
          >
            <Feather name="refresh-ccw" size={20} color="#d1d5db" />
            <Text
              style={{
                color: "#d1d5db",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "500",
              }}
            >
              Lật Cam
            </Text>
          </TouchableOpacity>

          {/* Nút Mic */}
          <TouchableOpacity onPress={toggleMic} style={getBtnStyle()}>
            <Feather
              name={isMicrophoneEnabled ? "mic" : "mic-off"}
              size={20}
              color={isMicrophoneEnabled ? "#d1d5db" : "#ef4444"}
            />
            <Text
              style={{
                color: isMicrophoneEnabled ? "#d1d5db" : "#ef4444",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "500",
              }}
            >
              Mic
            </Text>
          </TouchableOpacity>

          {/* Nút Thành Viên */}
          <TouchableOpacity onPress={onOpenMembers} style={getBtnStyle()}>
            <Feather name="users" size={20} color="#d1d5db" />
            <Text
              style={{
                color: "#d1d5db",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "500",
              }}
            >
              Thành viên
            </Text>
          </TouchableOpacity>

          {/* Nút Chat */}
          <TouchableOpacity onPress={onOpenChat} style={getBtnStyle()}>
            <Feather name="message-square" size={20} color="#d1d5db" />
            <Text
              style={{
                color: "#d1d5db",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "500",
              }}
            >
              Chat
            </Text>
          </TouchableOpacity>

          {/* Nút Giơ tay */}
          <TouchableOpacity onPress={toggleHandRaise} style={getBtnStyle()}>
            <Ionicons
              name="hand-left"
              size={20}
              color={isLocalHandRaised ? "#f59e0b" : "#d1d5db"}
            />
            <Text
              style={{
                color: isLocalHandRaised ? "#f59e0b" : "#d1d5db",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "500",
              }}
            >
              Giơ tay
            </Text>
          </TouchableOpacity>

          {/* Nút Quản trị viên (3 chấm) */}
          {isHost && (
            <TouchableOpacity
              onPress={() => setShowAdminMenu(true)}
              style={getBtnStyle()}
            >
              <Feather name="more-vertical" size={20} color="#d1d5db" />
              <Text
                style={{
                  color: "#d1d5db",
                  fontSize: 10,
                  marginTop: 4,
                  fontWeight: "500",
                }}
              >
                Quản lý
              </Text>
            </TouchableOpacity>
          )}

          {/* Nút Rời đi (Đổi icon và màu chữ) */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Rời phòng", "Bạn có chắc chắn muốn rời cuộc họp?", [
                { text: "Hủy", style: "cancel" },
                {
                  text: "Rời đi",
                  style: "destructive",
                  onPress: () => room.disconnect(),
                },
              ]);
            }}
            style={{ ...getBtnStyle(), paddingHorizontal: 12 }}
          >
            <Feather name="log-out" size={20} color="#ef4444" />
            <Text
              style={{
                color: "#ef4444",
                fontSize: 10,
                marginTop: 4,
                fontWeight: "bold",
              }}
            >
              Rời đi
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* MENU QUẢN TRỊ DẠNG BOTTOM SHEET */}
      <Modal visible={showAdminMenu} transparent animationType="slide">
        <TouchableOpacity
          activeOpacity={1}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          }}
          onPress={() => setShowAdminMenu(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: "#222",
              padding: 20,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderWidth: 1,
              borderColor: "#333",
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: "#444",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                color: "#9ca3af",
                fontSize: 12,
                fontWeight: "bold",
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              Bảo mật phòng họp
            </Text>

            {/* --- Switch Bật/Tắt Chat --- */}
            <TouchableOpacity
              onPress={handleToggleChat}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 14,
                paddingHorizontal: 12,
                backgroundColor: "#111",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="message-square"
                  size={20}
                  color={isChatEnabled ? "#10b981" : "#6b7280"}
                />
                <Text
                  style={{
                    color: "#d1d5db",
                    marginLeft: 12,
                    fontSize: 14,
                    fontWeight: "500",
                  }}
                >
                  Cho phép Chat
                </Text>
              </View>
              <CustomSwitch value={isChatEnabled} />
            </TouchableOpacity>

            {/* --- Switch Bật/Tắt Phòng chờ --- */}
            <TouchableOpacity
              onPress={handleToggleWaitingRoom}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 14,
                paddingHorizontal: 12,
                backgroundColor: "#111",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="shield"
                  size={20}
                  color={isWaitingRoomEnabled ? "#f59e0b" : "#6b7280"}
                />
                <Text
                  style={{
                    color: "#d1d5db",
                    marginLeft: 12,
                    fontSize: 14,
                    fontWeight: "500",
                  }}
                >
                  Phòng chờ
                </Text>
              </View>
              <CustomSwitch value={isWaitingRoomEnabled} />
            </TouchableOpacity>

            {/* --- Submenu: Chỉ định ai có thể duyệt --- */}
            {isWaitingRoomEnabled && (
              <View
                style={{
                  backgroundColor: "#111",
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#333",
                  overflow: "hidden",
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    setIsApprovalSubmenuOpen(!isApprovalSubmenuOpen)
                  }
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Feather name="user-check" size={20} color="#6b7280" />
                    <Text
                      style={{
                        color: "#d1d5db",
                        marginLeft: 12,
                        fontSize: 14,
                        fontWeight: "500",
                      }}
                    >
                      Ai có thể duyệt
                    </Text>
                  </View>
                  <Feather
                    name={
                      isApprovalSubmenuOpen ? "chevron-down" : "chevron-right"
                    }
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>

                {/* Danh sách xổ xuống */}
                {isApprovalSubmenuOpen && (
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: "#333",
                      backgroundColor: "#1a1a1a",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        handleUpdateApprovalPermission("admin_only")
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Feather
                        name="check"
                        size={16}
                        color={
                          approvalPermission === "admin_only"
                            ? "#10b981"
                            : "transparent"
                        }
                      />
                      <Text
                        style={{
                          color: "#d1d5db",
                          marginLeft: 12,
                          fontSize: 13,
                        }}
                      >
                        Chỉ Quản trị viên
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleUpdateApprovalPermission("member_and_admin")
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Feather
                        name="check"
                        size={16}
                        color={
                          approvalPermission === "member_and_admin"
                            ? "#10b981"
                            : "transparent"
                        }
                      />
                      <Text
                        style={{
                          color: "#d1d5db",
                          marginLeft: 12,
                          fontSize: 13,
                        }}
                      >
                        Thành viên
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleUpdateApprovalPermission("everyone")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Feather
                        name="check"
                        size={16}
                        color={
                          approvalPermission === "everyone"
                            ? "#10b981"
                            : "transparent"
                        }
                      />
                      <Text
                        style={{
                          color: "#d1d5db",
                          marginLeft: 12,
                          fontSize: 13,
                        }}
                      >
                        Tất cả mọi người
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
