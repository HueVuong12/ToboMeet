// hooks/useMeetingDeviceStatus.ts
import {
  useGetActiveMeetingQuery,
  useGetDeviceStatusQuery,
} from "../lib/redux/features/meetings/meetingsApi";
import { useDeviceId } from "./useDeviceId";

export function useMeetingDeviceStatus(
  roomId: string,
  activeChannelId: string | null,
) {
  const deviceId = useDeviceId();

  // Kiểm tra trạng thái thiết bị hiện tại
  const { data: deviceStatus } = useGetDeviceStatusQuery(
    {
      roomId,
      channelId: activeChannelId || "",
      deviceId: deviceId || "",
    },
    {
      skip: !activeChannelId || !deviceId,
    },
  );

  const isJoinedOnThisDevice = deviceStatus?.isJoinedOnThisDevice || false;

  // Theo dõi trạng thái cuộc họp hiện tại từ Server
  const { data: activeMeeting } = useGetActiveMeetingQuery(
    { roomId, channelId: activeChannelId || "" },
    { skip: !roomId || !activeChannelId, refetchOnMountOrArgChange: true },
  );

  return { isJoinedOnThisDevice, activeMeeting };
}
