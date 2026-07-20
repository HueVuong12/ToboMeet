// hooks/socket/useMeetingSocketEvents.ts
import { useEffect } from "react";
import { Alert } from "react-native";
import { socket } from "../../lib/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toast } from "../../lib/toast";

export function useMeetingSocketEvents() {
  useEffect(() => {
    const handleSwitchRequested = async (data: {
      userId: string;
      channelId: string;
      roomId: string;
      requesterSocketId: string;
    }) => {
      try {
        // Lấy trạng thái lưu từ AsyncStorage (Lưu ý: Phải có await)
        const activeChannel = await AsyncStorage.getItem(
          `active_meeting_${data.roomId}`,
        );

        if (activeChannel === data.channelId) {
          Alert.alert(
            "Yêu cầu chuyển thiết bị",
            "Thiết bị khác của bạn đang yêu cầu chuyển cuộc họp. Bạn có muốn cho phép không?",
            [
              { text: "Từ chối", style: "cancel" },
              {
                text: "Cho phép",
                style: "default",
                onPress: async () => {
                  // Xóa cờ ở thiết bị này
                  await AsyncStorage.removeItem(
                    `active_meeting_${data.roomId}`,
                  );

                  // Báo lại cho máy kia là đã nhả phòng
                  socket.emit("accept_switch_device", {
                    ...data,
                    targetSocketId: data.requesterSocketId, // Đẩy ID của Máy kia lên Server
                  });

                  toast.success("Đang tự động chuyển cuộc họp...");
                },
              },
            ],
          );
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra AsyncStorage:", error);
      }
    };

    socket.on("switch_device_requested", handleSwitchRequested);

    return () => {
      socket.off("switch_device_requested", handleSwitchRequested);
    };
  }, []);
}
