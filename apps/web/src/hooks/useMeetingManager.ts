import { useState, useRef, useEffect } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";
import { useJoinMeetingMutation } from "@/lib/redux/api/meetingsApi";

interface UseMeetingManagerProps {
  roomId: string;
  userId: string;
  currentChannel: any;
  activeChannel: string;
  setShowPreviewModal: (show: boolean) => void;
}

export function useMeetingManager({
  roomId,
  userId,
  currentChannel,
  activeChannel,
  setShowPreviewModal,
}: UseMeetingManagerProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [isJoinedOnThisDevice, setIsJoinedOnThisDevice] = useState(false);
  const [joinMeetingApi] = useJoinMeetingMutation();

  const meetingWindowRef = useRef<Window | null>(null);

  // Lắng nghe socket handoff và local storage
  useEffect(() => {
    const checkStatus = () => {
      const savedChannel = localStorage.getItem(`active_meeting_${roomId}`);
      setIsJoinedOnThisDevice(savedChannel === currentChannel?._id);
    };

    checkStatus();
    window.addEventListener("storage", checkStatus);

    const handleForceClose = (e: any) => {
      if (e.detail === roomId) {
        if (meetingWindowRef.current && !meetingWindowRef.current.closed) {
          meetingWindowRef.current.close();
        }
        setIsJoinedOnThisDevice(false);
      }
    };
    window.addEventListener("FORCE_CLOSE_MEETING_WINDOW", handleForceClose);

    return () => {
      window.removeEventListener("storage", checkStatus);
      window.removeEventListener(
        "FORCE_CLOSE_MEETING_WINDOW",
        handleForceClose,
      );
    };
  }, [currentChannel?._id, roomId]);

  const handleJoinMeeting = async (config: any, forceSwitch = false) => {
    if (!currentChannel?._id) return;

    try {
      setIsJoining(true);
      const response = await joinMeetingApi({
        roomId,
        channelId: currentChannel._id,
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

      localStorage.setItem(`active_meeting_${roomId}`, currentChannel._id);
      setIsJoinedOnThisDevice(true);

      setTimeout(() => {
        meetingWindowRef.current = window.open(meetingUrl, "_blank");
        const timer = setInterval(() => {
          if (meetingWindowRef.current?.closed) {
            clearInterval(timer);
            localStorage.removeItem(`active_meeting_${roomId}`);
            setIsJoinedOnThisDevice(false);
          }
        }, 1000);
      }, 800);
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
