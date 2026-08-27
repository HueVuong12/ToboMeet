// hooks/useMeetingLauncher.ts
import { useState } from "react";
import { useRouter } from "expo-router";
import { toast } from "../lib/toast";
import { useEnsureChannelMeetingMutation } from "../lib/redux/features/meetings/meetingsApi";

interface UseMeetingLauncherProps {
  roomId: string;
  activeChannelId: string | null;
}

export function useMeetingLauncher({
  roomId,
  activeChannelId,
}: UseMeetingLauncherProps) {
  const router = useRouter();
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [ensureChannelMeeting] = useEnsureChannelMeetingMutation();

  const handleStartOrJoinMeeting = async () => {
    if (!roomId || !activeChannelId) return;

    try {
      setIsEnsuring(true);
      const response = await ensureChannelMeeting({
        roomId,
        channelId: activeChannelId,
      }).unwrap();

      if (response?.meetingCode) {
        router.push(`/meeting/${response.meetingCode}`);
      }
    } catch (error: any) {
      toast.error(
        error?.data?.message ||
          error?.message ||
          "Không thể khởi tạo cuộc họp. Vui lòng thử lại!",
      );
    } finally {
      setIsEnsuring(false);
    }
  };

  return {
    handleStartOrJoinMeeting,
    // Giữ alias handleJoinMeeting để tương thích ngược nếu có chỗ gọi
    handleJoinMeeting: handleStartOrJoinMeeting,
    isJoining: isEnsuring,
    isEnsuring,
  };
}
