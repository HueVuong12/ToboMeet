import React, { useEffect, createContext, useContext } from "react";
import { Alert, DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { socket } from "../lib/socket";
import { toast } from "../lib/toast";

const EventContext = createContext<unknown>(null);

export function EventProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!userId) return;

    // 1. Đảm bảo Socket luôn kết nối
    if (!socket.connected) {
      socket.connect();
    }

    // LUÔN JOIN LẠI PHÒNG KHI CÓ KẾT NỐI MỚI/RECONNECT
    const handleConnect = () => {
      socket.emit("join_user_room", userId);
    };

    if (socket.connected) {
      handleConnect();
    }

    // Lắng nghe mỗi khi mạng chập chờn hoặc server restart xong
    socket.on("connect", handleConnect);

    // Xử lý yêu cầu xin nhường quyền Handoff từ thiết bị khác
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

                  // Phát sự kiện nội bộ của React Native để Màn hình Meeting tự động đóng
                  DeviceEventEmitter.emit(
                    "FORCE_CLOSE_MEETING_WINDOW",
                    data.roomId,
                  );

                  // Báo lại cho máy kia là đã nhả phòng
                  socket.emit("accept_switch_device", {
                    ...data,
                    targetSocketId: data.requesterSocketId, // Đẩy ID của Máy kia lên Server
                  });

                  toast.success("Đã chuyển cuộc họp sang thiết bị kia.");
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
      socket.off("connect", handleConnect);
      socket.off("switch_device_requested", handleSwitchRequested);
    };
  }, [userId]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
