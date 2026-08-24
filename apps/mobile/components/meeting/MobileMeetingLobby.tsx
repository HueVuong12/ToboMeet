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
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useCanStartMeetingQuery } from "../../lib/redux/features/meetings/meetingsApi";
import { toast } from "../../lib/toast";

interface MobileMeetingLobbyProps {
  meetingCode: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  camOn: boolean;
  setCamOn: (val: boolean) => void;
  micOn: boolean;
  setMicOn: (val: boolean) => void;
  cameraFacing: "front" | "back";
  setCameraFacing: (val: "front" | "back" | ((prev: "front" | "back") => "front" | "back")) => void;
  handleJoin: (allowStart?: boolean) => void;
  isJoining: boolean;
  onBack?: () => void;
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
  onBack,
}: MobileMeetingLobbyProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const { data: canStartData, isLoading: isCheckingCanStart } =
    useCanStartMeetingQuery({ meetingCode }, { skip: !meetingCode });

  const canStart = canStartData?.canStart ?? false;

  useEffect(() => {
    if (camOn && camPermission && !camPermission.granted) {
      requestCamPermission();
    }
  }, [camOn, camPermission]);

  useEffect(() => {
    if (micOn && micPermission && !micPermission.granted) {
      requestMicPermission();
    }
  }, [micOn, micPermission]);

  const handleCopyCode = () => {
    if (meetingCode) {
      Clipboard.setString(meetingCode);
      toast.info(t("meeting.lobby.code_copied", { defaultValue: "Đã sao chép mã cuộc họp" }));
    }
  };

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const onJoinPress = () => {
    handleJoin(canStart);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#09090b]" edges={["top", "bottom"]}>
      {/* Nền trang trí gradient mờ */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <View
          className="absolute -top-32 -left-20 w-80 h-80 rounded-full"
          style={{ backgroundColor: "rgba(0, 85, 255, 0.15)" }}
        />
        <View
          className="absolute top-1/3 -right-24 w-72 h-72 rounded-full"
          style={{ backgroundColor: "rgba(99, 102, 241, 0.12)" }}
        />
        <View
          className="absolute -bottom-28 left-10 w-72 h-72 rounded-full"
          style={{ backgroundColor: "rgba(14, 165, 233, 0.08)" }}
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            className="w-full max-w-[420px] self-center rounded-3xl border border-white/10 overflow-hidden"
            style={{
              backgroundColor: "rgba(18, 18, 22, 0.96)",
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 16 },
                  shadowOpacity: 0.5,
                  shadowRadius: 28,
                },
                android: { elevation: 14 },
              }),
            }}
          >
            {/* Header */}
            <View className="px-5 pt-4 pb-3 border-b border-white/5">
              <View className="flex-row items-center justify-between mb-2">
                <TouchableOpacity
                  onPress={handleBackPress}
                  className="w-9 h-9 rounded-full bg-white/5 border border-white/10 items-center justify-center active:bg-white/10"
                  activeOpacity={0.7}
                >
                  <Feather name="arrow-left" size={18} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                  className="flex-row items-center px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
                >
                  <Text className="text-[11px] text-slate-400 mr-1.5 font-medium">
                    {t("meeting.lobby.room_code", { defaultValue: "Mã:" })}
                  </Text>
                  <Text className="text-xs font-semibold font-mono text-blue-400 tracking-wider mr-1.5">
                    {meetingCode}
                  </Text>
                  <Feather name="copy" size={12} color="#60a5fa" />
                </TouchableOpacity>
              </View>

              <View className="items-center">
                <Text className="text-xl font-bold text-white tracking-tight mb-0.5">
                  {t("meeting.lobby.title", { defaultValue: "Chuẩn bị tham gia" })}
                </Text>
                <Text className="text-[12px] text-slate-400 text-center">
                  {t("meeting.lobby.subtitle", {
                    defaultValue: "Kiểm tra camera và micro trước khi vào",
                  })}
                </Text>
              </View>
            </View>

            {/* Body */}
            <View className="px-5 pt-4 pb-5 items-center">
              {/* Preview camera */}
              <View className="w-full aspect-[4/3] max-h-[300px] bg-[#050507] rounded-2xl border border-white/10 overflow-hidden mb-4 relative justify-center items-center">
                {camOn ? (
                  camPermission?.granted ? (
                    <>
                      <CameraView style={{ flex: 1, width: "100%" }} facing={cameraFacing} />
                      {/* Nút xoay camera nổi trên góc video */}
                      <TouchableOpacity
                        accessibilityLabel={t("meeting.lobby.flip_camera")}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 border border-white/20 items-center justify-center"
                        onPress={() =>
                          setCameraFacing((prev) => (prev === "front" ? "back" : "front"))
                        }
                        activeOpacity={0.7}
                      >
                        <Feather name="refresh-cw" size={15} color="#ffffff" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View className="items-center p-4">
                      <View className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 items-center justify-center mb-2.5">
                        <Feather name="camera-off" size={22} color="#f43f5e" />
                      </View>
                      <Text className="text-white text-xs font-semibold text-center mb-1">
                        {t("meeting.lobby.permission_cam_title", {
                          defaultValue: "Cần cấp quyền Camera",
                        })}
                      </Text>
                      <Text className="text-slate-400 text-[11px] text-center mb-3">
                        {t("meeting.lobby.permission_cam_desc", {
                          defaultValue: "Cho phép ứng dụng sử dụng camera để xem trước",
                        })}
                      </Text>
                      <TouchableOpacity
                        onPress={requestCamPermission}
                        className="bg-blue-600 px-4 py-2 rounded-xl active:bg-blue-700"
                      >
                        <Text className="text-white text-xs font-bold">
                          {t("meeting.lobby.grant_permission", { defaultValue: "Cấp quyền" })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <View className="w-16 h-16 rounded-full bg-white/5 border border-white/10 items-center justify-center mb-2.5">
                      <Feather name="video-off" size={26} color="#64748b" />
                    </View>
                    <Text className="text-slate-400 text-xs font-medium">
                      {t("meeting.lobby.camera_off", { defaultValue: "Camera đang tắt" })}
                    </Text>
                  </View>
                )}

                {/* Badge trạng thái micro khi tắt */}
                {!micOn && (
                  <View className="absolute top-3 left-3 bg-rose-500/90 px-2.5 py-1 rounded-full flex-row items-center border border-rose-400/30">
                    <Feather name="mic-off" size={11} color="#ffffff" />
                    <Text className="text-white text-[10px] font-semibold ml-1">
                      {t("meeting.lobby.mic_off_indicator", { defaultValue: "Đã tắt mic" })}
                    </Text>
                  </View>
                )}

                <View className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              </View>

              {/* Controls Bar */}
              <View className="flex-row justify-center items-center gap-4 mb-4">
                <TouchableOpacity
                  accessibilityLabel={
                    micOn ? t("meeting.lobby.mic_on") : t("meeting.lobby.mic_off")
                  }
                  className={`rounded-full items-center justify-center border transition-all ${
                    micOn
                      ? "bg-white/10 border-white/15"
                      : "bg-rose-500/20 border-rose-500/40"
                  }`}
                  style={{ width: 50, height: 50 }}
                  onPress={() => setMicOn(!micOn)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={micOn ? "mic" : "mic-off"}
                    size={20}
                    color={micOn ? "#ffffff" : "#fb7185"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel={
                    camOn ? t("meeting.lobby.cam_on") : t("meeting.lobby.cam_off")
                  }
                  className={`rounded-full items-center justify-center border transition-all ${
                    camOn
                      ? "bg-white/10 border-white/15"
                      : "bg-rose-500/20 border-rose-500/40"
                  }`}
                  style={{ width: 50, height: 50 }}
                  onPress={() => setCamOn(!camOn)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={camOn ? "video" : "video-off"}
                    size={20}
                    color={camOn ? "#ffffff" : "#fb7185"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel={t("meeting.lobby.flip_camera")}
                  className={`rounded-full items-center justify-center bg-white/10 border border-white/15 ${
                    camOn && camPermission?.granted ? "opacity-100" : "opacity-30"
                  }`}
                  style={{ width: 50, height: 50 }}
                  onPress={() =>
                    camOn &&
                    setCameraFacing((prev) => (prev === "front" ? "back" : "front"))
                  }
                  disabled={!camOn || !camPermission?.granted}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Tên hiển thị input */}
              <View className="w-full mb-4">
                <Text className="text-[12px] font-medium text-slate-400 mb-1.5">
                  {t("meeting.lobby.display_name", { defaultValue: "Tên hiển thị" })}
                </Text>
                <View className="flex-row items-center w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5">
                  <Feather name="user" size={16} color="#64748b" style={{ marginRight: 8 }} />
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t("meeting.lobby.display_name_placeholder", {
                      defaultValue: "Nhập tên của bạn",
                    })}
                    placeholderTextColor="#475569"
                    className="flex-1 text-sm text-white p-0"
                    returnKeyType="done"
                  />
                  {displayName.length > 0 && (
                    <TouchableOpacity onPress={() => setDisplayName("")}>
                      <Feather name="x" size={14} color="#64748b" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Nút tham gia / bắt đầu */}
              <TouchableOpacity
                className={`w-full py-3.5 rounded-xl items-center justify-center flex-row shadow-lg shadow-blue-600/30 ${
                  isJoining || isCheckingCanStart ? "opacity-60" : "active:opacity-90"
                }`}
                style={{ backgroundColor: "#0052FF" }}
                onPress={onJoinPress}
                disabled={isJoining || isCheckingCanStart}
                activeOpacity={0.85}
              >
                {isJoining || isCheckingCanStart ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Feather
                      name={canStart ? "video" : "log-in"}
                      size={18}
                      color="#ffffff"
                    />
                    <Text className="text-white text-[15px] font-bold">
                      {canStart
                        ? t("meeting.lobby.start_meeting", { defaultValue: "Bắt đầu cuộc họp" })
                        : t("meeting.lobby.join_now", { defaultValue: "Tham gia ngay" })}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text className="mt-3 text-center text-[10px] text-slate-500 leading-4">
                {t("meeting.lobby.privacy_notice", {
                  defaultValue:
                    "Bạn có thể điều chỉnh thiết bị và bật/tắt mic, camera bất kỳ lúc nào trong cuộc họp.",
                })}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
