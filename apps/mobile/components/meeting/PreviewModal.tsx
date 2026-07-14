import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DeviceConfig } from "../../hooks/useMeetingManager";

export default function PreviewModal({
  isOpen,
  onClose,
  onJoin,
  isJoining,
}: {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (config: DeviceConfig) => void;
  isJoining: boolean;
}) {
  const [isPreviewCamOn, setIsPreviewCamOn] = useState(true);
  const [isPreviewMicOn, setIsPreviewMicOn] = useState(true);

  // 1. Sử dụng Hook để quản lý trạng thái quyền (Tự động re-render khi quyền thay đổi)
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");

  const insets = useSafeAreaInsets();

  // 2. Tự động xin quyền khi Modal được mở lên
  useEffect(() => {
    if (isOpen) {
      if (!camPermission?.granted) requestCamPermission();
      if (!micPermission?.granted) requestMicPermission();
    }
  }, [isOpen, camPermission?.granted, micPermission?.granted]);

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false}>
      <View
        className="flex-1 bg-slate-950 p-5"
        style={{
          paddingTop: Math.max(insets.top, 20), // Đẩy xuống khỏi tai thỏ/camera đục lỗ
          paddingBottom: Math.max(insets.bottom, 20), // Đẩy lên khỏi phím điều hướng
        }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white text-xl font-bold">
            Chuẩn bị tham gia
          </Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Video Preview Container */}
        <View className="flex-1 bg-slate-900 rounded-3xl overflow-hidden mb-6 border border-slate-800 justify-center items-center">
          {isPreviewCamOn ? (
            // 3. KIỂM TRA QUYỀN TRƯỚC KHI RENDER CAMERAVIEW
            camPermission?.granted ? (
              <>
                <CameraView
                  style={{ flex: 1, width: "100%" }}
                  facing={facing}
                  mute={true}
                />

                <TouchableOpacity
                  className="absolute top-4 right-4 w-12 h-12 bg-black/40 rounded-full justify-center items-center border border-white/20"
                  onPress={() =>
                    setFacing((prev) => (prev === "front" ? "back" : "front"))
                  }
                >
                  <Feather name="refresh-ccw" size={20} color="white" />
                </TouchableOpacity>
              </>
            ) : (
              <View className="items-center p-4">
                <Feather name="camera-off" size={48} color="#475569" />
                <Text className="text-slate-400 mt-4 text-center">
                  Cần cấp quyền Camera để hiển thị hình ảnh
                </Text>
                <TouchableOpacity
                  onPress={requestCamPermission}
                  className="mt-4 bg-blue-600 px-5 py-2.5 rounded-xl active:bg-blue-700"
                >
                  <Text className="text-white font-bold">Cấp quyền ngay</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View className="items-center">
              <Feather name="video-off" size={48} color="#475569" />
              <Text className="text-slate-500 mt-2 font-medium">
                Camera đang tắt
              </Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View className="flex-row justify-center gap-6 mb-8">
          <TouchableOpacity
            onPress={() => setIsPreviewMicOn(!isPreviewMicOn)}
            className={`w-16 h-16 rounded-full items-center justify-center ${isPreviewMicOn ? "bg-slate-800" : "bg-red-500"}`}
          >
            <Feather
              name={isPreviewMicOn ? "mic" : "mic-off"}
              size={24}
              color="white"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsPreviewCamOn(!isPreviewCamOn)}
            className={`w-16 h-16 rounded-full items-center justify-center ${isPreviewCamOn ? "bg-slate-800" : "bg-red-500"}`}
          >
            <Feather
              name={isPreviewCamOn ? "video" : "video-off"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* Join Button */}
        <TouchableOpacity
          className="bg-blue-600 py-4 rounded-2xl items-center active:bg-blue-700 mb-6"
          onPress={() =>
            onJoin({
              isCamOn: isPreviewCamOn,
              isMicOn: isPreviewMicOn,
              cameraFacing: facing,
            })
          }
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Tham gia ngay</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
