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
import { useChatStatus } from "../../hooks/useChatStatus";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const { isHost, isChatEnabled, handleToggleChat } = useChatStatus({
    roomId,
    channelId,
    meetingCode,
  });

  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    initialFacingMode || "user",
  );

  const [showAdminMenu, setShowAdminMenu] = useState(false);

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
          <View
            style={{
              backgroundColor: "#222", // Đổi màu nền menu sang xám đậm
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
              Công cụ Quản trị
            </Text>

            <TouchableOpacity
              onPress={() => {
                handleToggleChat();
                setShowAdminMenu(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                paddingHorizontal: 12,
                backgroundColor: "#111", // Nền nút đen tuyền
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
              }}
            >
              <Feather
                name={isChatEnabled ? "lock" : "unlock"}
                size={20}
                color={isChatEnabled ? "#ef4444" : "#10b981"}
              />
              <Text
                style={{
                  color: isChatEnabled ? "#ef4444" : "#10b981",
                  marginLeft: 12,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {isChatEnabled ? "Khóa Chat với mọi người" : "Mở Chat"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
