// src/hooks/useMeetingDeviceStatus.ts
import { useEffect } from "react";
import { useGetDeviceStatusQuery } from "@/lib/redux/api/meetingsApi";
import { useDeviceId } from "./useDeviceId";
import { useMeetingCacheManager } from "./useMeetingCacheManager";

export function useMeetingDeviceStatus(
  meetingCode?: string | null,
  roomId?: string,
) {
  const deviceId = useDeviceId();
  const { clearMeetingDeviceStatus } = useMeetingCacheManager();

  // Lấy trạng thái thiết bị từ API
  const { data: deviceStatus } = useGetDeviceStatusQuery(
    {
      meetingCode: meetingCode || "",
      deviceId: deviceId || "",
    },
    {
      skip: !meetingCode || !deviceId,
    },
  );

  const isJoinedOnThisDevice = deviceStatus?.isJoinedOnThisDevice || false;

  // Đồng bộ cache khi có tín hiệu tắt tab từ phòng họp
  useEffect(() => {
    if (!roomId && !meetingCode) return;

    const syncChannelName = roomId
      ? `meeting_sync_${roomId}`
      : `meeting_sync_${meetingCode}`;
    const syncChannel = new BroadcastChannel(syncChannelName);

    syncChannel.onmessage = (event) => {
      if (event.data?.type === "MEETING_DISCONNECTED") {
        clearMeetingDeviceStatus(event.data.meetingCode || meetingCode || "");
      }
    };

    return () => {
      syncChannel.close();
    };
  }, [roomId, meetingCode, clearMeetingDeviceStatus]);

  return { isJoinedOnThisDevice };
}
