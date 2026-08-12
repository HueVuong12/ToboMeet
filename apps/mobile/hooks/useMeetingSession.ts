// hooks/useMeetingSession.ts
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MeetingPayload, MeetingStore } from "../lib/meetingStore";
import { AudioSession } from "@livekit/react-native";
import { Room } from "livekit-client";
import { toast } from "../lib/toast";
import { useMeetingCacheManager } from "./useMeetingCacheManager";
import {
  useJoinMeetingByCodeMutation,
  useLazyGetMemberStatusQuery,
} from "../lib/redux/features/meetings/meetingsApi";
import { useDeviceId } from "./useDeviceId";
import { useGetMeQuery } from "../lib/redux/features/users/usersApi";

export function useMeetingSession() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const meetingCode = code as string;
  const router = useRouter();
  const deviceId = useDeviceId();
  const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL;

  // Trạng thái thiết bị ở Sảnh chờ
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("front");

  const [meetingData, setMeetingData] = useState<MeetingPayload | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const [customRoom, setCustomRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<"LOADING" | "IN_LOBBY" | "JOINED">(
    "LOADING",
  );
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: myProfile } = useGetMeQuery();
  const { clearMeetingDeviceStatus } = useMeetingCacheManager();
  const [getMemberStatus] = useLazyGetMemberStatusQuery();
  const [joinMeetingByCodeApi, { isLoading: isJoining }] =
    useJoinMeetingByCodeMutation();

  useEffect(() => {
    if (!myProfile) return;
    if (!myProfile.displayName) return;
    setDisplayName(myProfile.displayName);
  }, [myProfile]);

  // Khởi tạo dữ liệu phòng
  useEffect(() => {
    if (!meetingCode) return;

    const data = MeetingStore.get();

    // Nếu chưa nhận được token từ preview modal thì vào lobby
    if (data) {
      setMeetingData(data);
      MeetingStore.clear();
      setStatus("JOINED");
    } else {
      setStatus("IN_LOBBY");
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
  }, [meetingCode]);

  // Khởi tạo LiveKit Room tùy chỉnh
  useEffect(() => {
    if (status !== "JOINED" || !meetingData) return;

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
  const onRoomError = (error: unknown) => {
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

      handleSmartRedirect();
    }, 600);
  };

  const handleSmartRedirect = async () => {
    try {
      const memberStatus = await getMemberStatus({ meetingCode }).unwrap();

      if (memberStatus.isMember && memberStatus.roomId) {
        router.replace(`/room/${memberStatus.roomId}`);
      } else {
        router.replace("/dashboard");
      }
    } catch (error) {
      console.log(error);
      router.replace("/dashboard");
    }
  };

  const handleJoinByCode = async () => {
    if (!meetingCode || !deviceId) {
      toast.error("Đang tải định danh thiết bị, vui lòng thử lại!");
      return;
    }

    try {
      const response = await joinMeetingByCodeApi({
        meetingCode,
        deviceId,
        displayName: displayName || "Người dùng ẩn danh",
      }).unwrap();

      setMeetingData({
        token: response.token,
        roomId: response.roomId,
        channelId: response.channelId,
        isCamOn: camOn,
        isMicOn: micOn,
        cameraFacing,
      });

      setStatus("JOINED");
    } catch (error: any) {
      if (error?.code === 4013) {
        toast.error("Bạn đang ở trong phòng này trên thiết bị/tab khác.");
      } else if (error?.code === 4014) {
        toast.error("Cuộc họp chưa bắt đầu hoặc đã kết thúc");
      } else {
        toast.error("Không thể tham gia cuộc họp lúc này.");
      }
    }
  };

  return {
    code,
    status,
    LIVEKIT_URL,
    meetingData,
    customRoom,
    handleJoinByCode,
    isJoining,
    camOn,
    setCamOn,
    micOn,
    setMicOn,
    cameraFacing,
    setCameraFacing,
    displayName,
    setDisplayName,
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
