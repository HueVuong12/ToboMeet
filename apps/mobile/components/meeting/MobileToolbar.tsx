import React, { useState } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

// LIVEKIT COMPONENTS (Safely loaded for Expo Go)
let useRoomContext: any = () => null;
let useLocalParticipant: any = () => ({ localParticipant: null, isMicrophoneEnabled: false, isCameraEnabled: false });
try {
  const livekit = require("@livekit/react-native");
  useRoomContext = livekit.useRoomContext;
  useLocalParticipant = livekit.useLocalParticipant;
} catch (e) {
  console.warn("LiveKit hooks not available in Expo Go");
}
import { toast } from "../../lib/toast";
import { useHandRaise } from "../../hooks/useHandRaise";

// COMPONENT: THANH ĐIỀU KHIỂN
export default function MobileToolbar({
  initialFacingMode,
  onOpenMembers,
  onOpenChat,
}: {
  initialFacingMode?: "user" | "environment";
  onOpenMembers: () => void;
  onOpenChat: () => void;
}) {
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();
  const { isLocalHandRaised, toggleHandRaise } = useHandRaise();

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    initialFacingMode || "user",
  );

  const handleFlipCamera = async () => {
    const trackPublication = localParticipant.videoTrackPublications
      .values()
      .next().value;

    if (trackPublication?.videoTrack) {
      const videoTrack = trackPublication.videoTrack;
      // Đảo ngược trạng thái hiện tại
      const newFacingMode = facingMode === "user" ? "environment" : "user";

      try {
        // Gọi API của LiveKit để khởi động lại Camera với hướng mới
        await videoTrack.restartTrack({ facingMode: newFacingMode });
        setFacingMode(newFacingMode); // Lưu lại trạng thái
      } catch (error) {
        console.error(error);
        toast.error("Không thể lật Camera lúc này.");
      }
    }
  };

  return (
    <View
      style={{
        backgroundColor: "#0f172a",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.05)",
        gap: 6, // Giảm gap một chút xíu để nhét thêm nút mà không bị tràn màn hình
      }}
    >
      {/* Nút Camera */}
      <TouchableOpacity
        onPress={toggleCam}
        style={{
          width: 44, // Thu nhỏ một chút xíu để vừa màn hình
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

      {/* Nút Lật Camera (Chỉ sáng lên khi đang bật Camera) */}
      <TouchableOpacity
        onPress={handleFlipCamera}
        disabled={!isCameraEnabled} // Khóa nút nếu chưa bật cam
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: "#1e293b",
          justifyContent: "center",
          alignItems: "center",
          opacity: isCameraEnabled ? 1 : 0.4, // Làm mờ đi nếu không dùng được
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
              onPress: () => {
                room.disconnect();
              },
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
    </View>
  );
}
