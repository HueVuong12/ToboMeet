// hooks/socket/useMeetingSocketEvents.ts
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { toast } from "sonner";

export function useMeetingSocketEvents() {
  useEffect(() => {
    const handleSwitchRequested = (data: {
      userId: string;
      channelId: string;
      roomId: string;
      requesterSocketId: string;
    }) => {
      const activeChannel = localStorage.getItem(
        `active_meeting_${data.roomId}`,
      );

      if (activeChannel === data.channelId) {
        toast("Thiết bị khác đang yêu cầu chuyển cuộc họp.", {
          duration: 10000,
          action: {
            label: "Cho phép",
            onClick: () => {
              localStorage.removeItem(`active_meeting_${data.roomId}`);
              window.dispatchEvent(
                new CustomEvent("FORCE_CLOSE_MEETING_WINDOW", {
                  detail: data.roomId,
                }),
              );
              socket.emit("accept_switch_device", {
                ...data,
                targetSocketId: data.requesterSocketId,
              });
              toast.success("Đã chuyển cuộc họp sang thiết bị kia.");
            },
          },
        });
      }
    };

    socket.on("switch_device_requested", handleSwitchRequested);

    return () => {
      socket.off("switch_device_requested", handleSwitchRequested);
    };
  }, []);
}
