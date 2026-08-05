import React, { useEffect, createContext, useContext, useRef } from "react";
import { socket } from "../lib/socket";
import { AppState, AppStateStatus } from "react-native";
import { useDispatch } from "react-redux";
import { roomsApi } from "../lib/redux/features/rooms/roomsApi";
import { toast } from "../lib/toast";

const EventContext = createContext<unknown>(null);

export function EventProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  const dispatch = useDispatch();
  const appState = useRef(AppState.currentState);

  // Quản lý trạng thái Socket theo vòng đời của App (AppState)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App được mở lại lên màn hình chính -> Kết nối lại Socket
          if (!socket.connected) {
            socket.connect();
          }
        } else if (
          nextAppState === "background" ||
          nextAppState === "inactive"
        ) {
          // App bị ẩn đi (người dùng thoát ra màn hình chính) -> Ngắt kết nối
          if (socket.connected) {
            socket.disconnect();
          }
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

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

    // Lắng nghe sự kiện khi chính mình được thêm vào phòng họp mới
    const handleUserRoomAdded = (data: any) => {
      if (!data) return;
      dispatch(roomsApi.util.invalidateTags(["Room"]));
      toast.info(`Bạn vừa được thêm vào phòng "${data.room?.name || "mới"}"`);
    };

    socket.on("user_room_added", handleUserRoomAdded);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("user_room_added", handleUserRoomAdded);
    };
  }, [userId, dispatch]);

  return <EventContext.Provider value={{}}>{children}</EventContext.Provider>;
}

export const useEventContext = () => useContext(EventContext);
