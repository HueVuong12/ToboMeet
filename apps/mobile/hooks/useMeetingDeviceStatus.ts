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

  // Theo dõi trạng thái cuộc họp hiện tại từ Server
  const { data: activeMeeting } = useGetActiveMeetingQuery(
    { roomId, channelId: activeChannelId || "" },
    { skip: !roomId || !activeChannelId, refetchOnMountOrArgChange: true },
  );

  // Kiểm tra trạng thái thiết bị hiện tại
  const { data: deviceStatus } = useGetDeviceStatusQuery(
    {
      meetingCode: activeMeeting?.meetingCode || "",
      deviceId: deviceId || "",
    },
    {
      skip: !activeMeeting?.meetingCode || !deviceId,
    },
  );

  const isJoinedOnThisDevice = deviceStatus?.isJoinedOnThisDevice || false;

  return { isJoinedOnThisDevice, activeMeeting };
}
