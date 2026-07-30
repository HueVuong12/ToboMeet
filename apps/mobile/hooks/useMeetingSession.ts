// hooks/useMeetingSession.ts
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MeetingPayload, MeetingStore } from "../lib/meetingStore";
import { AudioSession } from "@livekit/react-native";
import { Room } from "livekit-client";
import { toast } from "../lib/toast";
import { useMeetingCacheManager } from "./useMeetingCacheManager";

export function useMeetingSession() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  const [meetingData, setMeetingData] = useState<MeetingPayload | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const [customRoom, setCustomRoom] = useState<Room | null>(null);

  // Thêm trạng thái quản lý lúc đang ngắt kết nối
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { clearMeetingDeviceStatus } = useMeetingCacheManager();

  // Khởi tạo dữ liệu phòng và cấu hình Audio
  useEffect(() => {
    const data = MeetingStore.get();
    if (data) {
      setMeetingData(data);
      MeetingStore.clear();
    }

    const configureAudio = async () => {
      try {
        await AudioSession.startAudioSession();
      } catch (error) {
        console.error("Lỗi khi khởi động hệ thống âm thanh:", error);
        toast.error("Lỗi khi khởi động hệ thống âm thanh");
      }
    };
    configureAudio();
  }, []);

  // Khởi tạo LiveKit Room tùy chỉnh
  useEffect(() => {
    if (!meetingData) return;

    const roomInstance = new Room({
      adaptiveStream: false,
      dynacast: true,
      videoCaptureDefaults: {
        facingMode: (meetingData.cameraFacing === "back"
          ? "environment"
          : "user") as "user" | "environment",
      },
    });

    setCustomRoom(roomInstance);

    return () => {
      roomInstance.disconnect();
    };
  }, [meetingData]);

  // Tối ưu cấu hình kết nối để không bị lag
  const connectOptions = useMemo(() => {
    return {
      autoSubscribe: false,
    };
  }, []);

  // Xử lý khi có lỗi WebRTC
  const onRoomError = (error: any) => {
    console.error("Bắt được lỗi WebRTC:", error);
    customRoom?.disconnect();
  };

  // Hàm xử lý dọn dẹp và điều hướng khi ngắt kết nối
  const onRoomDisconnected = () => {
    setIsDisconnecting(true); // Kích hoạt trạng thái loading ngắt kết nối

    // Tạo một khoảng trễ nhỏ để UI kịp render màn hình loading rời phòng
    setTimeout(() => {
      if (meetingData) {
        clearMeetingDeviceStatus(meetingData.roomId, meetingData.channelId);
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/home");
      }
    }, 600);
  };

  return {
    code,
    LIVEKIT_URL,
    meetingData,
    customRoom,
    connectOptions,
    isDisconnecting,
    showMembersModal,
    setShowMembersModal,
    showChatModal,
    setShowChatModal,
    onRoomError,
    onRoomDisconnected,
  };
}
