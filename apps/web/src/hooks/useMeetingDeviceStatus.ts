// src/hooks/useMeetingDeviceStatus.ts
import { useEffect } from "react";
import { useGetDeviceStatusQuery } from "@/lib/redux/api/meetingsApi";
import { useDeviceId } from "./useDeviceId";
import { useMeetingCacheManager } from "./useMeetingCacheManager";

export function useMeetingDeviceStatus(
  roomId: string,
  channelId: string | undefined,
) {
  const deviceId = useDeviceId();
  const { clearMeetingDeviceStatus } = useMeetingCacheManager();

  // Lấy trạng thái thiết bị từ API
  const { data: deviceStatus } = useGetDeviceStatusQuery(
    {
      roomId,
      channelId: channelId || "",
      deviceId: deviceId || "",
    },
    {
      skip: !channelId || !deviceId,
    },
  );

  const isJoinedOnThisDevice = deviceStatus?.isJoinedOnThisDevice || false;

  // Đồng bộ cache khi có tín hiệu tắt tab từ phòng họp
  useEffect(() => {
    if (!roomId) return;

    const syncChannel = new BroadcastChannel(`meeting_sync_${roomId}`);

    syncChannel.onmessage = (event) => {
      if (event.data?.type === "MEETING_DISCONNECTED") {
        const disconnectedChannelId = event.data.channelId;
        clearMeetingDeviceStatus(roomId, disconnectedChannelId);
      }
    };

    return () => {
      syncChannel.close();
    };
  }, [roomId, clearMeetingDeviceStatus]);

  return { isJoinedOnThisDevice };
}
