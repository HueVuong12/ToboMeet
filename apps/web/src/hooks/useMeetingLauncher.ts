// src/hooks/useMeetingLauncher.ts
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useJoinChannelMeetingMutation } from "@/lib/redux/api/meetingsApi";
import { useDeviceId } from "./useDeviceId";
import { useTranslations } from "next-intl";

interface UseMeetingLauncherProps {
  roomId: string;
  currentChannel: any;
  activeChannel: string;
  setShowPreviewModal: (show: boolean) => void;
}

export function useMeetingLauncher({
  roomId,
  currentChannel,
  activeChannel,
  setShowPreviewModal,
}: UseMeetingLauncherProps) {
  const tServer = useTranslations("server.errors");
  const meetingWindowRef = useRef<Window | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinChannelMeetingApi] = useJoinChannelMeetingMutation();
  const deviceId = useDeviceId();

  const handleJoinMeeting = async (config: any, forceSwitch = false) => {
    if (!currentChannel?._id) return;

    if (!deviceId) {
      toast.error("Đang khởi tạo định danh thiết bị, vui lòng thử lại!");
      return;
    }

    try {
      setIsJoining(true);
      const response = await joinChannelMeetingApi({
        roomId,
        channelId: currentChannel._id,
        deviceId: deviceId,
        displayName: config.displayName || undefined,
        forceSwitch,
      }).unwrap();

      setShowPreviewModal(false);

      const meetingUrl = `/meeting/${response.meetingCode}`;

      const bc = new BroadcastChannel(`token_channel_${response.meetingCode}`);
      bc.onmessage = (event) => {
        if (event.data === "TAB_B_READY") {
          bc.postMessage({
            type: "TOKEN_PAYLOAD",
            token: response.token,
            roomId: roomId,
            channelId: currentChannel._id,
            deviceConfig: {
              camOn: config.isCamOn,
              micOn: config.isMicOn,
              micId: config.micId,
              speakerId: config.speakerId,
              cameraConfig: {
                deviceId: config.cameraId,
                width: config.resolution.width,
                height: config.resolution.height,
              },
            },
          });
          setTimeout(() => bc.close(), 500);
        }
      };

      meetingWindowRef.current = window.open(meetingUrl, "_blank");
    } catch (error: any) {
      if (error?.code === 4013) {
        setShowPreviewModal(false);

        toast.warning(tServer("4013") || "Bạn đang ở trong phòng này trên thiết bị/tab khác.", {
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
        const msg = (error?.code && tServer(String(error.code))) || "Không thể tham gia cuộc họp lúc này.";
        toast.error(msg);
      }
    } finally {
      setIsJoining(false);
    }
  };

  return { handleJoinMeeting, isJoining };
}
