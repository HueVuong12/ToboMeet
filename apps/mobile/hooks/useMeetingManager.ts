import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useJoinMeetingMutation,
  useGetActiveMeetingQuery,
} from "../lib/redux/features/rooms/roomsApi";
import { socket } from "../lib/socket";
import { toast } from "../lib/toast";
import { MeetingStore } from "../lib/meetingStore";

interface UseMeetingManagerProps {
  roomId: string;
  activeChannelId: string | null;
  userId?: string;
  displayName?: string;
}

export function useMeetingManager({
  roomId,
  activeChannelId,
  userId,
  displayName,
}: UseMeetingManagerProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [isJoinedOnThisDevice, setIsJoinedOnThisDevice] = useState(false);

  const [joinMeeting] = useJoinMeetingMutation();

  // Theo dõi trạng thái cuộc họp hiện tại từ Server
  const { data: activeMeeting } = useGetActiveMeetingQuery(
    { roomId, channelId: activeChannelId || "" },
    { skip: !roomId || !activeChannelId },
  );

  // Kiểm tra Local Storage (AsyncStorage) xem máy này có đang họp không
  useEffect(() => {
    const checkActiveDevice = async () => {
      if (!roomId) return;
      const savedChannel = await AsyncStorage.getItem(
        `active_meeting_${roomId}`,
      );
      setIsJoinedOnThisDevice(savedChannel === activeChannelId);
    };
    checkActiveDevice();
  }, [roomId, activeChannelId, activeMeeting]);

  // Lắng nghe Socket khi thiết bị khác đồng ý nhường phòng
  useEffect(() => {
    const handleSwitchAccepted = async (data: any) => {
      if (data.channelId === activeChannelId) {
        toast.success("Đã kết nối thiết bị mới, đang vào phòng...");
        // Gọi lại hàm join với forceSwitch = true
        handleJoinMeeting(true);
      }
    };

    socket.on("switch_device_accepted", handleSwitchAccepted);
    return () => {
      socket.off("switch_device_accepted", handleSwitchAccepted);
    };
  }, [activeChannelId]);

  // Hàm xử lý tham gia cuộc họp
  const handleJoinMeeting = async (
    forceSwitch = false,
    config?: { isCamOn: boolean; isMicOn: boolean },
  ) => {
    if (!roomId || !activeChannelId) return;

    const isCamOn = config?.isCamOn ?? true;
    const isMicOn = config?.isMicOn ?? false;

    try {
      setIsJoining(true);
      const response = await joinMeeting({
        roomId,
        channelId: activeChannelId,
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
                socket.emit("request_switch_device", {
                  userId,
                  channelId: activeChannelId,
                  roomId: roomId,
                  requesterSocketId: socket.id,
                });
                toast.info(
                  "Vui lòng xác nhận chuyển đổi trên màn hình thiết bị cũ của bạn...",
                );
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
