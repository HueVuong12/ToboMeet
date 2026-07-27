import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toast } from "../lib/toast";
import { MeetingStore } from "../lib/meetingStore";
import {
  useGetActiveMeetingQuery,
  useJoinMeetingMutation,
} from "../lib/redux/features/meetings/meetingsApi";
import { useDeviceId } from "./useDeviceId";

interface UseMeetingManagerProps {
  roomId: string;
  activeChannelId: string | null;
  displayName?: string;
}

export interface DeviceConfig {
  isCamOn: boolean;
  isMicOn: boolean;
  cameraFacing: "front" | "back";
}

export function useMeetingManager({
  roomId,
  activeChannelId,
  displayName,
}: UseMeetingManagerProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [isJoinedOnThisDevice, setIsJoinedOnThisDevice] = useState(false);
  const deviceId = useDeviceId();

  const [joinMeeting] = useJoinMeetingMutation();

  // Theo dõi trạng thái cuộc họp hiện tại từ Server
  const { data: activeMeeting } = useGetActiveMeetingQuery(
    { roomId, channelId: activeChannelId || "" },
    { skip: !roomId || !activeChannelId, refetchOnMountOrArgChange: true },
  );

  // Kiểm tra Local Storage (AsyncStorage) xem máy này có đang họp không
  useEffect(() => {
    const checkActiveDevice = async () => {
      if (!roomId) return;
      const savedChannel = await AsyncStorage.getItem(
        `active_meeting_${roomId}`,
      );

      // Nếu Server báo phòng này hiện KHÔNG CÓ cuộc họp nào diễn ra
      // nhưng điện thoại lại có lưu cờ (do lần trước crash app) -> Lập tức xóa cờ rác!
      if (activeMeeting && !activeMeeting.isOngoing && savedChannel) {
        await AsyncStorage.removeItem(`active_meeting_${roomId}`);
        setIsJoinedOnThisDevice(false);
        return;
      }

      setIsJoinedOnThisDevice(savedChannel === activeChannelId);
    };
    checkActiveDevice();
  }, [roomId, activeChannelId, activeMeeting]);

  // Hàm xử lý tham gia cuộc họp
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

      // Đánh dấu thiết bị Mobile này đang trong cuộc họp
      await AsyncStorage.setItem(`active_meeting_${roomId}`, activeChannelId);
      setIsJoinedOnThisDevice(true);

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
                toast.info("Đang chuyển thiết bị và vào phòng...");
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

  return {
    handleJoinMeeting,
    isJoining,
    isJoinedOnThisDevice,
    activeMeeting,
  };
}
