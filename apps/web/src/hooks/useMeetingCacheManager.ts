import { useDispatch } from "react-redux";
import { AppDispatch } from "@/lib/redux/store";
import { useDeviceId } from "./useDeviceId";
import { meetingsApi } from "@/lib/redux/api/meetingsApi";

export function useMeetingCacheManager() {
  const dispatch = useDispatch<AppDispatch>();
  const deviceId = useDeviceId();

  /**
   * Làm sạch trạng thái thiết bị trong phòng
   */
  const clearMeetingDeviceStatus = (roomId: string, channelId: string) => {
    if (!deviceId) return;

    dispatch(
      meetingsApi.util.invalidateTags([
        {
          type: "DeviceStatus",
          id: `${roomId}-${channelId}-${deviceId}`,
        },
      ]),
    );
  };

  return {
    clearMeetingDeviceStatus,
  };
}
