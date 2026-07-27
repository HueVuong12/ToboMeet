import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  useGetDeviceStatusQuery,
  useJoinMeetingMutation,
} from "@/lib/redux/api/meetingsApi";
import { useDeviceId } from "./useDeviceId";

interface UseMeetingManagerProps {
  roomId: string;
  currentChannel: any;
  activeChannel: string;
  setShowPreviewModal: (show: boolean) => void;
}

export function useMeetingManager({
  roomId,
  currentChannel,
  activeChannel,
  setShowPreviewModal,
}: UseMeetingManagerProps) {
  const meetingWindowRef = useRef<Window | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinMeetingApi] = useJoinMeetingMutation();
  const deviceId = useDeviceId();

  const { data: deviceStatus } = useGetDeviceStatusQuery(
    {
      roomId,
      channelId: currentChannel?._id,
      deviceId: deviceId || "",
    },
    {
      skip: !currentChannel?._id || !deviceId, // Chỉ gọi khi đã có đủ thông tin
      pollingInterval: 10000, // Tự động cập nhật 10s/lần để UI không bao giờ bị lệch
    },
  );
  const isJoinedOnThisDevice = deviceStatus?.isJoinedOnThisDevice || false;

  const handleJoinMeeting = async (config: any, forceSwitch = false) => {
    if (!currentChannel?._id) return;

    if (!deviceId) {
      toast.error("Đang khởi tạo định danh thiết bị, vui lòng thử lại!");
      return;
    }

    try {
      setIsJoining(true);
      const response = await joinMeetingApi({
        roomId,
        channelId: currentChannel._id,
        deviceId: deviceId,
        displayName: config.displayName || undefined,
        forceSwitch,
      }).unwrap();

      const cameraConfig = encodeURIComponent(
        JSON.stringify({
          deviceId: config.cameraId,
          width: config.resolution.width,
          height: config.resolution.height,
        }),
      );

      setShowPreviewModal(false);

      const meetingUrl = `/meeting/${response.meetingCode}?cam=${config.isCamOn}&cameraConfig=${cameraConfig}&mic=${config.isMicOn}&micId=${config.micId}&speakerId=${config.speakerId}`;

      const bc = new BroadcastChannel(`token_channel_${response.meetingCode}`);
      bc.onmessage = (event) => {
        if (event.data === "TAB_B_READY") {
          bc.postMessage({
            type: "TOKEN_PAYLOAD",
            token: response.token,
            roomId: roomId,
            channelId: currentChannel._id,
            channelName: activeChannel,
          });
          setTimeout(() => bc.close(), 500);
        }
      };

      meetingWindowRef.current = window.open(meetingUrl, "_blank");
    } catch (error: any) {
      if (error?.code === 4013) {
        setShowPreviewModal(false);

        // Hiện thông báo và hỏi người dùng có muốn ngắt kết nối thiết bị kia không
        toast.warning("Bạn đang ở trong phòng này trên thiết bị/tab khác.", {
          duration: 10000,
          action: {
            label: "Ngắt kết nối máy kia & Vào phòng",
            onClick: () => {
              handleJoinMeeting(config, true);
              toast.info("Đang chuyển thiết bị và vào phòng...");
            },
          },
        });
      } else {
        toast.error("Không thể tham gia cuộc họp lúc này.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  return { handleJoinMeeting, isJoining, isJoinedOnThisDevice };
}
