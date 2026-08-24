// hooks/useMeetingLauncher.ts
import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { toast } from "../lib/toast";
import { MeetingStore } from "../lib/meetingStore";
import { useJoinChannelMeetingMutation } from "../lib/redux/features/meetings/meetingsApi";
import { useDeviceId } from "./useDeviceId";

interface UseMeetingLauncherProps {
  roomId: string;
  activeChannelId: string | null;
  displayName?: string;
}

export interface DeviceConfig {
  isCamOn: boolean;
  isMicOn: boolean;
  cameraFacing: "front" | "back";
}

export function useMeetingLauncher({
  roomId,
  activeChannelId,
  displayName,
}: UseMeetingLauncherProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const deviceId = useDeviceId();
  const [joinMeeting] = useJoinChannelMeetingMutation();

  const handleJoinMeeting = async (
    forceSwitch = false,
    config?: DeviceConfig,
  ) => {
    if (!roomId || !activeChannelId) return;

    if (!deviceId) {
      toast.error("Đang khởi tạo định danh thiết bị, vui lòng thử lại!");
      return;
    }

    const isCamOn = config?.isCamOn ?? true;
    const isMicOn = config?.isMicOn ?? false;
    const cameraFacing = config?.cameraFacing;

    try {
      setIsJoining(true);
      const response = await joinMeeting({
        roomId,
        channelId: activeChannelId,
        deviceId: deviceId,
        displayName: displayName || "Người dùng",
        forceSwitch,
      }).unwrap();

      MeetingStore.set({
        token: response.token,
        roomId: roomId,
        channelId: activeChannelId,
        isCamOn: isCamOn,
        isMicOn: isMicOn,
        cameraFacing: cameraFacing,
      });

      // Chuyển hướng sang màn hình Gọi Video
      router.push(`/meeting/${response.meetingCode}`);
    } catch (error: any) {
      // Xử lý lỗi 4013: Đang họp trên thiết bị khác (Handoff)
      if (error?.code === 4013) {
        Alert.alert(
          "Đang trong cuộc họp",
          "Bạn đang ở trong phòng này trên một thiết bị khác. Bạn có muốn chuyển sang điện thoại này không?",
          [
            { text: "Hủy", style: "cancel" },
            {
              text: "Chuyển sang máy này",
              onPress: () => {
                handleJoinMeeting(true, config);
                toast.info("Đã chuyển thiết bị và vào phòng...");
              },
            },
          ],
        );
      } else {
        toast.error("Không thể tham gia cuộc họp lúc này.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  return { handleJoinMeeting, isJoining };
}
