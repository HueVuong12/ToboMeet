import React, { useState } from "react";
import { View, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";

// LIVEKIT COMPONENTS
import { useRoomContext, useLocalParticipant } from "@livekit/react-native";

// COMPONENT: THANH ĐIỀU KHIỂN
export default function MobileToolbar({
  onOpenMembers,
  onOpenChat,
}: {
  onOpenMembers: () => void;
  onOpenChat: () => void;
}) {
  const room = useRoomContext();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } =
    useLocalParticipant();
  const [isHandRaised, setIsHandRaised] = useState(false);

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const toggleCam = () => localParticipant.setCameraEnabled(!isCameraEnabled);

  return (
    <View
      style={{
        backgroundColor: "#0f172a", // Nền tối hòa vào background
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 12,
        paddingBottom: 28, // Tránh rãnh vuốt dưới đáy iOS/Android
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.05)",
        gap: 8, // Khoảng cách đều, nhỏ gọn giống web
      }}
    >
      {/* Nút Camera */}
      <TouchableOpacity
        onPress={toggleCam}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: "#1e293b", // Màu slate tối thanh lịch
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather
          name={isCameraEnabled ? "video" : "video-off"}
          size={20}
          color="white"
        />
      </TouchableOpacity>

      {/* Nút Mic */}
      <TouchableOpacity
        onPress={toggleMic}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: "#1e293b",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather
          name={isMicrophoneEnabled ? "mic" : "mic-off"}
          size={20}
          color="white"
        />
      </TouchableOpacity>

      {/* Nút Giơ tay */}
      <TouchableOpacity
        onPress={() => setIsHandRaised(!isHandRaised)}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: isHandRaised ? "rgba(245, 158, 11, 0.2)" : "#1e293b",
          borderWidth: isHandRaised ? 1 : 0,
          borderColor: "rgba(245, 158, 11, 0.3)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather
          name="heart"
          size={20}
          color={isHandRaised ? "#f59e0b" : "white"}
        />
      </TouchableOpacity>

      {/* Nút Rời đi (Màu đỏ, bo góc giống các nút khác, không có text) */}
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
          width: 56, // Hơi rộng hơn chút xíu để làm điểm nhấn
          height: 48,
          borderRadius: 14,
          backgroundColor: "#ef4444",
          justifyContent: "center",
          alignItems: "center",
          marginHorizontal: 4, // Tách nhẹ ra khỏi các nút chức năng
        }}
      >
        <Feather name="phone-off" size={20} color="white" />
      </TouchableOpacity>

      {/* Nút Thành Viên */}
      <TouchableOpacity
        onPress={onOpenMembers}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: "#1e293b",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather name="users" size={20} color="white" />
      </TouchableOpacity>

      {/* Nút Chat */}
      <TouchableOpacity
        onPress={onOpenChat}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: "#1e293b",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather name="message-square" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );
}
