// components/meeting/MobileMeetingLobby.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";

interface MobileMeetingLobbyProps {
  meetingCode: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  camOn: boolean;
  setCamOn: (val: boolean) => void;
  micOn: boolean;
  setMicOn: (val: boolean) => void;
  cameraFacing: "front" | "back";
  setCameraFacing: (val: "front" | "back") => void;
  handleJoin: () => void;
  isJoining: boolean;
}

export default function MobileMeetingLobby({
  meetingCode,
  displayName,
  setDisplayName,
  camOn,
  setCamOn,
  micOn,
  setMicOn,
  cameraFacing,
  setCameraFacing,
  handleJoin,
  isJoining,
}: MobileMeetingLobbyProps) {
  // Hook xin quyền sử dụng Camera từ Expo
  const [permission, requestPermission] = useCameraPermissions();

  // Tự động xin quyền khi người dùng bật Camera ở sảnh chờ
  useEffect(() => {
    if (camOn && permission && !permission.granted) {
      requestPermission();
    }
  }, [camOn, permission]);

  return (
    <View className="flex-1 bg-[#111] justify-center items-center p-5">
      <View className="bg-[#222] w-full max-w-[400px] rounded-[24px] p-6 border border-[#333] items-center">
        {/* Header Sảnh chờ */}
        <Text className="text-2xl font-bold text-slate-100 mb-1">
          Chuẩn bị tham gia
        </Text>
        <View className="bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full flex-row items-center mb-6">
          <Text className="text-xs text-slate-400 mr-2">Mã phòng:</Text>
          <Text className="text-sm font-semibold font-mono text-blue-400">
            {meetingCode}
          </Text>
        </View>

        {/* Khung Preview (Tỉ lệ 3:4) - Tích hợp Expo Camera */}
        <View className="w-full aspect-[3/4] bg-[#111] rounded-2xl border border-[#333] overflow-hidden mb-6 relative">
          {camOn && permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              facing={cameraFacing}
            />
          ) : (
            <View className="flex-1 justify-center items-center">
              <Feather
                name="video-off"
                size={48}
                color="#64748b"
                className="mb-3 opacity-60"
              />
              <Text className="text-slate-400 text-sm font-medium">
                Camera đang tắt
              </Text>
            </View>
          )}

          {/* Badge Mic Off - Hiển thị đè lên góc phải của Camera */}
          {!micOn && (
            <View className="absolute top-4 right-4 bg-red-500/90 p-2 rounded-lg shadow-sm">
              <Feather name="mic-off" size={16} color="#fff" />
            </View>
          )}
        </View>

        {/* Hàng nút điều khiển nhanh (Mic / Cam / Xoay Cam) */}
        <View className="flex-row justify-center gap-5 mb-6">
          <TouchableOpacity
            className={`w-14 h-14 rounded-full justify-center items-center shadow-sm ${
              micOn ? "bg-[#333]" : "bg-red-500"
            }`}
            onPress={() => setMicOn(!micOn)}
          >
            <Feather name={micOn ? "mic" : "mic-off"} size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            className={`w-14 h-14 rounded-full justify-center items-center shadow-sm ${
              camOn ? "bg-[#333]" : "bg-red-500"
            }`}
            onPress={() => setCamOn(!camOn)}
          >
            <Feather
              name={camOn ? "video" : "video-off"}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          {/* Nút Đảo Camera (Chỉ kích hoạt khi Cam đang bật) */}
          <TouchableOpacity
            className={`w-14 h-14 rounded-full justify-center items-center bg-[#333] ${
              camOn ? "opacity-100" : "opacity-50"
            }`}
            onPress={() =>
              camOn &&
              setCameraFacing(cameraFacing === "front" ? "back" : "front")
            }
            disabled={!camOn}
          >
            <Feather name="refresh-cw" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tên hiển thị */}
        <View className="w-full mb-6">
          <Text className="text-sm font-semibold text-slate-300 mb-2">
            Tên hiển thị
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nhập tên của bạn"
            placeholderTextColor="#64748b"
            className="w-full px-4 py-3.5 border border-[#444] rounded-xl text-sm bg-[#111] text-white"
          />
        </View>

        {/* Nút Tham Gia */}
        <TouchableOpacity
          className={`bg-blue-600 w-full py-4 rounded-xl justify-center items-center flex-row ${
            isJoining ? "opacity-70" : ""
          }`}
          onPress={handleJoin}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-base font-bold">
              Tham gia ngay
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
