// components/meeting/MobileMeetingLobby.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (camOn && permission && !permission.granted) {
      requestPermission();
    }
  }, [camOn, permission]);

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]" edges={["top", "bottom"]}>
      {/* Nền trang trí (nằm trong safe area) */}
      <View pointerEvents="none" className="absolute inset-0">
        <View
          className="absolute -top-24 -left-20 w-72 h-72 rounded-full"
          style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}
        />
        <View
          className="absolute top-1/3 -right-16 w-64 h-64 rounded-full"
          style={{ backgroundColor: "rgba(56, 189, 248, 0.07)" }}
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View
            className="w-full max-w-[400px] self-center rounded-3xl border border-white/10 overflow-hidden"
            style={{
              backgroundColor: "rgba(18, 18, 20, 0.95)",
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.4,
                  shadowRadius: 24,
                },
                android: { elevation: 12 },
              }),
            }}
          >
            {/* Header */}
            <View className="px-5 pt-5 pb-4 items-center border-b border-white/5">
              <Text className="text-xl font-semibold text-white tracking-tight mb-1">
                {t("meeting.lobby.title")}
              </Text>
              <Text className="text-[13px] text-slate-500 mb-3 text-center">
                {t("meeting.lobby.subtitle")}
              </Text>

              <View className="flex-row items-center px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Text className="text-[11px] text-slate-500 mr-2">
                  {t("meeting.lobby.room_code")}
                </Text>
                <Text className="text-sm font-semibold font-mono text-emerald-400 tracking-wide">
                  {meetingCode}
                </Text>
              </View>
            </View>

            <View className="px-5 pt-4 pb-5 items-center">
              {/* Preview camera — giới hạn chiều cao để không đẩy form ra ngoài */}
              <View className="w-full aspect-[3/4] max-h-[340px] bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden mb-4 relative">
                {camOn && permission?.granted ? (
                  <CameraView style={{ flex: 1 }} facing={cameraFacing} />
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <View className="w-14 h-14 rounded-full bg-white/5 border border-white/10 items-center justify-center mb-3">
                      <Feather name="video-off" size={26} color="#64748b" />
                    </View>
                    <Text className="text-slate-500 text-sm font-medium">
                      {t("meeting.lobby.camera_off")}
                    </Text>
                  </View>
                )}

                {!micOn && (
                  <View className="absolute top-3 right-3 bg-rose-500/90 p-2 rounded-xl border border-rose-400/30">
                    <Feather name="mic-off" size={15} color="#fff" />
                  </View>
                )}
              </View>

              {/* Controls */}
              <View className="flex-row justify-center items-center gap-4 mb-5">
                <TouchableOpacity
                  accessibilityLabel={
                    micOn
                      ? t("meeting.lobby.mic_on")
                      : t("meeting.lobby.mic_off")
                  }
                  className={`w-13 h-13 rounded-full items-center justify-center border ${
                    micOn
                      ? "bg-white/10 border-white/10"
                      : "bg-rose-500/20 border-rose-500/30"
                  }`}
                  style={{ width: 52, height: 52 }}
                  onPress={() => setMicOn(!micOn)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={micOn ? "mic" : "mic-off"}
                    size={20}
                    color={micOn ? "#fff" : "#fb7185"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel={
                    camOn
                      ? t("meeting.lobby.cam_on")
                      : t("meeting.lobby.cam_off")
                  }
                  className={`rounded-full items-center justify-center border ${
                    camOn
                      ? "bg-white/10 border-white/10"
                      : "bg-rose-500/20 border-rose-500/30"
                  }`}
                  style={{ width: 52, height: 52 }}
                  onPress={() => setCamOn(!camOn)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={camOn ? "video" : "video-off"}
                    size={20}
                    color={camOn ? "#fff" : "#fb7185"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel={t("meeting.lobby.flip_camera")}
                  className={`rounded-full items-center justify-center bg-white/10 border border-white/10 ${
                    camOn ? "opacity-100" : "opacity-40"
                  }`}
                  style={{ width: 52, height: 52 }}
                  onPress={() =>
                    camOn &&
                    setCameraFacing(cameraFacing === "front" ? "back" : "front")
                  }
                  disabled={!camOn}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={18} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Tên hiển thị */}
              <View className="w-full mb-4">
                <Text className="text-[13px] font-medium text-slate-400 mb-1.5">
                  {t("meeting.lobby.display_name")}
                </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t("meeting.lobby.display_name_placeholder")}
                  placeholderTextColor="#475569"
                  className="w-full px-4 py-3.5 rounded-xl text-sm text-white border border-white/10"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                  returnKeyType="done"
                />
              </View>

              {/* Nút tham gia */}
              <TouchableOpacity
                className={`w-full py-3.5 rounded-xl items-center justify-center flex-row ${
                  isJoining ? "opacity-60" : ""
                }`}
                style={{ backgroundColor: "#059669" }}
                onPress={handleJoin}
                disabled={isJoining}
                activeOpacity={0.85}
              >
                {isJoining ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white text-[15px] font-semibold">
                    {t("meeting.lobby.join_now")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
