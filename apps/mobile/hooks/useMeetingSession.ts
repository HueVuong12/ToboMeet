// hooks/useMeetingSession.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MeetingPayload, MeetingStore } from "../lib/meetingStore";
import { AudioSession } from "@livekit/react-native";
import { Room } from "livekit-client";
import { toast } from "../lib/toast";
import { useMeetingCacheManager } from "./useMeetingCacheManager";
import {
  useJoinBreakoutRoomMutation,
  useJoinMeetingByCodeMutation,
  useLazyGetMemberStatusQuery,
  useReturnToMainRoomMutation,
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
  const [status, setStatus] = useState<
    | "LOADING"
    | "IN_LOBBY"
    | "JOINED"
    | "SWITCHING_BREAKOUT"
    | "RETURNING_TO_MAIN"
  >("LOADING");
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: myProfile } = useGetMeQuery();
  const { clearMeetingDeviceStatus } = useMeetingCacheManager();
  const [getMemberStatus] = useLazyGetMemberStatusQuery();
  const [joinMeetingByCodeApi, { isLoading: isJoining }] =
    useJoinMeetingByCodeMutation();
  const [returnToMainRoomApi, { isLoading: isLeavingBreakout }] =
    useReturnToMainRoomMutation();
  const [joinBreakoutApi, { isLoading: isJoiningBreakout }] =
    useJoinBreakoutRoomMutation();

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

  const handleSmartRedirect = useCallback(async () => {
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
  }, [getMemberStatus, meetingCode, router]);

  // Hàm xử lý dọn dẹp và điều hướng khi ngắt kết nối
  const onRoomDisconnected = useCallback(() => {
    setIsDisconnecting(true); // Kích hoạt trạng thái loading ngắt kết nối

    // Tạo một khoảng trễ nhỏ để UI kịp render màn hình loading rời phòng
    setTimeout(() => {
      if (meetingData) {
        clearMeetingDeviceStatus(meetingData.roomId, meetingData.channelId);
      }

      handleSmartRedirect();
    }, 600);
  }, [meetingData, clearMeetingDeviceStatus, handleSmartRedirect]);

  const handleDisconnect = useCallback(() => {
    if (customRoom) {
      customRoom.disconnect();
    } else {
      onRoomDisconnected();
    }
  }, [customRoom, onRoomDisconnected]);

  // Tham gia phòng breakout
  const handleSwitchToBreakout = useCallback(
    async (newRoomId: string) => {
      if (!deviceId || !meetingCode) return;

      try {
        const response = await joinBreakoutApi({
          code: meetingCode,
          breakoutRoomId: newRoomId,
          deviceId,
        }).unwrap();

        setStatus("SWITCHING_BREAKOUT");

        // Cập nhật Token mới
        setMeetingData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            token: response.token,
            roomId: newRoomId,
          };
        });

        setTimeout(() => {
          setStatus("JOINED");
        }, 1000);
      } catch (error: any) {
        const msg =
          error?.data?.message ||
          error?.message ||
          "Không thể tham gia nhóm thảo luận lúc này.";
        toast.error(msg);
        setStatus("JOINED");
      }
    },
    [meetingCode, deviceId, joinBreakoutApi],
  );

  // Quay về phòng chính
  const handleReturnToMain = useCallback(
    async (fullBreakoutRoomName: string) => {
      if (!deviceId) return;
      try {
        const response = await returnToMainRoomApi({
          fullBreakoutRoomName,
          deviceId,
        }).unwrap();

        setStatus("RETURNING_TO_MAIN");

        // Cập nhật lại token để tham gia phòng chính
        setMeetingData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            token: response.token,
            roomId: response.roomId,
            channelId: response.channelId,
          };
        });

        setTimeout(() => {
          setStatus("JOINED");
        }, 1000);
      } catch (error: any) {
        const msg =
          error?.data?.message ||
          error?.message ||
          "Không thể quay về phòng chính lúc này.";
        toast.error(msg);
        setStatus("JOINED");
      }
    },
    [deviceId, returnToMainRoomApi],
  );

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
    isJoiningBreakout,
    isLeavingBreakout,
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
    handleDisconnect,
    handleSwitchToBreakout,
    handleReturnToMain,
  };
}

