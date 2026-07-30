// src/hooks/useMeetingSession.ts
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useDeviceId } from "@/hooks/useDeviceId";
import { useMeetingCacheManager } from "@/hooks/useMeetingCacheManager";
import {
  useJoinMeetingByCodeMutation,
  useLazyGetMemberStatusQuery,
} from "@/lib/redux/api/meetingsApi";
import { useGetMeQuery } from "@/lib/redux/features/users/usersApi";

export function useMeetingSession() {
  const searchParams = useSearchParams();
  const params = useParams();
  const deviceId = useDeviceId();
  const { clearMeetingDeviceStatus } = useMeetingCacheManager();
  const [getMemberStatus] = useLazyGetMemberStatusQuery();

  const meetingCode = params.code as string;

  // Trạng thái thiết bị (Lobby)
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [hardwareConfig, setHardwareConfig] = useState<{
    micId?: string | null;
    speakerId?: string | null;
    parsedCameraConfig?: {
      deviceId?: string;
      width?: number;
      height?: number;
    } | null;
  }>({});
  const [displayName, setDisplayName] = useState("");

  // Trạng thái kết nối
  const [meetingData, setMeetingData] = useState<{
    token: string;
    roomId: string;
    channelId: string;
    channelName: string;
  } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [status, setStatus] = useState<
    "LOOKING_FOR_TOKEN" | "IN_LOBBY" | "JOINED" | "RECONNECTING"
  >("LOOKING_FOR_TOKEN");

  const [joinMeetingByCodeApi, { isLoading: isJoining }] =
    useJoinMeetingByCodeMutation();

  const hasTriedReconnectRef = useRef(false);
  const isUnloadingRef = useRef(false);

  // ===== KIỂM TRA ĐĂNG NHẬP (AUTHENTICATION) =====
  const {
    data: myProfile,
    error: myProfileError,
    isLoading: isAuthenticating,
  } = useGetMeQuery();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    console.log("my profile", myProfile);
    if (!isAuthenticating) {
      if (myProfile !== undefined) {
        // Có dữ liệu trả về thành công -> Đã đăng nhập
        setIsAuthenticated(true);
      } else if (myProfileError) {
        // Có lỗi (thường là 401/403) -> Chưa đăng nhập
        setIsAuthenticated(false);
      }
    }
  }, [myProfile, myProfileError, isAuthenticating]);
  // =================================================

  // Phục hồi lại cài đặt thiết bị từ sessionStorage
  useEffect(() => {
    const storedConfigStr = sessionStorage.getItem(
      `device_config_${meetingCode}`,
    );
    if (storedConfigStr) {
      try {
        const storedConfig = JSON.parse(storedConfigStr);
        setCamOn(storedConfig.camOn ?? false);
        setMicOn(storedConfig.micOn ?? false);
        setHardwareConfig({
          micId: storedConfig.micId,
          speakerId: storedConfig.speakerId,
          parsedCameraConfig: storedConfig.cameraConfig,
        });
      } catch (e) {
        console.error("Lỗi khi đọc cấu hình thiết bị từ session", e);
      }
    }
  }, [meetingCode]);

  // Lắng nghe sự kiện F5 hoặc tắt Tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, []);

  const handleSmartRedirect = async (
    fallbackRoomId?: string,
    isIntentionalLeave = false,
  ) => {
    try {
      const memberStatus = await getMemberStatus({ meetingCode }).unwrap();

      if (memberStatus.isMember && memberStatus.roomId) {
        window.location.href = `/room/${memberStatus.roomId}`;
      } else {
        if (isIntentionalLeave) {
          window.location.href = "/dashboard";
        } else {
          setStatus("IN_LOBBY");
        }
      }
    } catch (error) {
      if (fallbackRoomId) {
        window.location.href = `/room/${fallbackRoomId}`;
      } else {
        window.location.href = "/dashboard";
      }
    }
  };

  const handleJoinByCode = useCallback(async () => {
    if (!meetingCode) return;
    if (!deviceId) {
      console.log("[Meeting] Waiting for deviceId...");
      return;
    }

    try {
      const savedName = sessionStorage.getItem(`meeting_name_${meetingCode}`);
      const finalName = displayName || savedName || undefined;

      const response = await joinMeetingByCodeApi({
        meetingCode,
        deviceId: deviceId,
        displayName: finalName,
      }).unwrap();

      sessionStorage.setItem(`is_joined_${meetingCode}`, "true");
      if (finalName) {
        sessionStorage.setItem(`meeting_name_${meetingCode}`, finalName);
      }

      // Lưu lại thiết lập ở sảnh vào Session để xài lại
      sessionStorage.setItem(
        `device_config_${meetingCode}`,
        JSON.stringify({
          camOn,
          micOn,
          micId: hardwareConfig.micId,
          speakerId: hardwareConfig.speakerId,
          cameraConfig: hardwareConfig.parsedCameraConfig,
        }),
      );

      setMeetingData({
        token: response.token,
        roomId: response.roomId,
        channelId: response.channelId,
        channelName: response.channelName,
      });

      setStatus("JOINED");
      hasTriedReconnectRef.current = false;
    } catch (error: any) {
      sessionStorage.removeItem(`is_joined_${meetingCode}`);
      hasTriedReconnectRef.current = false;

      if (error?.code === 4013) {
        toast.error("Bạn đang ở trong phòng này trên thiết bị/tab khác.");
      } else if (error?.code === 4014) {
        toast.error("Cuộc họp chưa bắt đầu hoặc đã kết thúc");
        await handleSmartRedirect();
      } else {
        toast.error("Không thể kết nối lại cuộc họp. Vui lòng thử lại.");
        setStatus("IN_LOBBY");
      }
    }
  }, [meetingCode, displayName, deviceId, joinMeetingByCodeApi]);

  // Kiểm tra Session hoặc xin Token qua BroadcastChannel
  useEffect(() => {
    if (!meetingCode || status !== "LOOKING_FOR_TOKEN") return;

    const isJoined = sessionStorage.getItem(`is_joined_${meetingCode}`);

    if (isJoined) {
      setStatus("RECONNECTING");
      return;
    }

    const bc = new BroadcastChannel(`token_channel_${meetingCode}`);

    bc.onmessage = (event) => {
      if (event.data?.type === "TOKEN_PAYLOAD") {
        sessionStorage.setItem(`is_joined_${meetingCode}`, "true");

        // Lưu cấu hình nhận được từ kênh Broadcast vào state và session
        if (event.data.deviceConfig) {
          sessionStorage.setItem(
            `device_config_${meetingCode}`,
            JSON.stringify(event.data.deviceConfig),
          );
          setCamOn(event.data.deviceConfig.camOn);
          setMicOn(event.data.deviceConfig.micOn);
          setHardwareConfig({
            micId: event.data.deviceConfig.micId,
            speakerId: event.data.deviceConfig.speakerId,
            parsedCameraConfig: event.data.deviceConfig.cameraConfig,
          });
        }

        setMeetingData({
          token: event.data.token,
          roomId: event.data.roomId,
          channelId: event.data.channelId,
          channelName: event.data.channelName,
        });
        setStatus("JOINED");
        bc.close();
      }
    };

    bc.postMessage("TAB_B_READY");

    // Nếu không nhận được token thì fallback vào lobby để xin token
    const timeout = setTimeout(() => {
      if (status === "LOOKING_FOR_TOKEN") {
        setStatus("IN_LOBBY");
        bc.close();
      }
    }, 1500);

    return () => {
      bc.close();
      clearTimeout(timeout);
    };
  }, [meetingCode, status, handleJoinByCode]);

  // khi RECONNECTING + deviceId sẵn sàng → join
  useEffect(() => {
    if (status !== "RECONNECTING") return;
    if (!deviceId) return;
    if (hasTriedReconnectRef.current) return;

    hasTriedReconnectRef.current = true;
    handleJoinByCode();
  }, [status, deviceId, handleJoinByCode]);

  const handleDisconnect = () => {
    if (isUnloadingRef.current) return;

    setIsDisconnecting(true);

    setTimeout(() => {
      sessionStorage.removeItem(`is_joined_${meetingCode}`);
      sessionStorage.removeItem(`meeting_name_${meetingCode}`);
      // Xoá cấu hình thiết bị khi rời khỏi phòng
      sessionStorage.removeItem(`device_config_${meetingCode}`);

      if (meetingData) {
        clearMeetingDeviceStatus(meetingData?.roomId, meetingData?.channelId);
        const syncChannel = new BroadcastChannel(
          `meeting_sync_${meetingData.roomId}`,
        );
        syncChannel.postMessage({
          type: "MEETING_DISCONNECTED",
          channelId: meetingData.channelId,
        });
        syncChannel.close();
      }

      window.close();

      setTimeout(() => {
        handleSmartRedirect(meetingData?.roomId, true);
      }, 300);
    }, 1000);
  };

  return {
    isAuthenticated,
    meetingCode,
    status,
    meetingData,
    isDisconnecting,
    isJoining,
    camOn,
    setCamOn,
    micOn,
    setMicOn,
    displayName,
    setDisplayName,
    handleJoinByCode,
    handleDisconnect,
    hardwareConfig,
  };
}
