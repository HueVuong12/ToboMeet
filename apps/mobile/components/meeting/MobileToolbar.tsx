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

// LIVEKIT COMPONENTS
import { useRoomContext, useLocalParticipant } from "@livekit/react-native";
import { toast } from "../../lib/toast";
import { useHandRaise } from "../../hooks/useHandRaise";
import { useChatStatus } from "../../hooks/useChatStatus"; // Bổ sung hook quản lý chat
import { useSafeAreaInsets } from "react-native-safe-area-context";

// COMPONENT: THANH ĐIỀU KHIỂN
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

  // Khởi tạo Hook Quản lý Chat
  const { isHost, isChatEnabled, handleToggleChat } = useChatStatus({
    roomId,
    channelId,
    meetingCode,
  });

  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    initialFacingMode || "user",
  );

  // State quản lý Menu Admin
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

  return (
    <>
      <View
        style={{
          backgroundColor: "#0f172a",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.05)",
        }}
      >
        {/* Chuyển sang ScrollView ngang để chứa nhiều nút không bị tràn */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 12,
            gap: 6,
          }}
        >
          {/* Nút Camera */}
          <TouchableOpacity
            onPress={toggleCam}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#1e293b",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather
              name={isCameraEnabled ? "video" : "video-off"}
              size={18}
              color="white"
            />
          </TouchableOpacity>

          {/* Nút Lật Camera */}
          <TouchableOpacity
            onPress={handleFlipCamera}
            disabled={!isCameraEnabled}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#1e293b",
              justifyContent: "center",
              alignItems: "center",
              opacity: isCameraEnabled ? 1 : 0.4,
            }}
          >
            <Feather name="refresh-ccw" size={18} color="white" />
          </TouchableOpacity>

          {/* Nút Mic */}
          <TouchableOpacity
            onPress={toggleMic}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#1e293b",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather
              name={isMicrophoneEnabled ? "mic" : "mic-off"}
              size={18}
              color="white"
            />
          </TouchableOpacity>

          {/* NÚT GIƠ TAY */}
          <TouchableOpacity
            onPress={toggleHandRaise}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: isLocalHandRaised
                ? "rgba(245, 158, 11, 0.2)"
                : "#1e293b",
              borderWidth: isLocalHandRaised ? 1 : 0,
              borderColor: "rgba(245, 158, 11, 0.3)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="hand-left"
              size={18}
              color={isLocalHandRaised ? "#f59e0b" : "white"}
            />
          </TouchableOpacity>

          {/* Nút Rời đi */}
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
            style={{
              width: 52,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#ef4444",
              justifyContent: "center",
              alignItems: "center",
              marginHorizontal: 2,
            }}
          >
            <Feather name="phone-off" size={18} color="white" />
          </TouchableOpacity>

          {/* Nút Thành Viên */}
          <TouchableOpacity
            onPress={onOpenMembers}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#1e293b",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name="users" size={18} color="white" />
          </TouchableOpacity>

          {/* Nút Chat */}
          <TouchableOpacity
            onPress={onOpenChat}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#1e293b",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather name="message-square" size={18} color="white" />
          </TouchableOpacity>

          {/* NÚT QUẢN TRỊ VIÊN (3 CHẤM) */}
          {isHost && (
            <TouchableOpacity
              onPress={() => setShowAdminMenu(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: "#1e293b",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather name="more-vertical" size={18} color="white" />
            </TouchableOpacity>
          )}
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
            paddingTop: Math.max(insets.top, 20), // Đẩy xuống khỏi tai thỏ/camera đục lỗ
            paddingBottom: Math.max(insets.bottom, 20),
          }}
          onPress={() => setShowAdminMenu(false)}
        >
          <View
            style={{
              backgroundColor: "#1e293b",
              padding: 20,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: "#475569",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                color: "#94a3b8",
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
                backgroundColor: isChatEnabled
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(16, 185, 129, 0.1)",
                borderRadius: 12,
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
                  fontSize: 16,
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
