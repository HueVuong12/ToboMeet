import { useDispatch } from "react-redux";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { NotificationResponse } from "@tobomeet/shared/types";
import { AppDispatch } from "@/lib/redux/store";
import { usersApi } from "@/lib/redux/features/users/usersApi";

export function useNotificationCacheManager() {
  const dispatch = useDispatch<AppDispatch>();

  const addNotificationsToCache = (
    newNotifications: NotificationResponse[],
  ) => {
    if (!newNotifications || newNotifications.length === 0) return;

    // 1. Cập nhật cache chính (Tab "Tất cả" - không có filter type hay isRead)
    // Args { page: 1 } sẽ được serializeQueryArgs chuyển thành key "getNotifications-all-all"
    dispatch(
      notificationsApi.util.updateQueryData(
        "getNotifications",
        { page: 1 },
        (draft) => {
          // Push thông báo mới lên đầu mảng
          draft.items.unshift(...newNotifications);
          draft.total += newNotifications.length;
        },
      ),
    );

    // 2. (Tuỳ chọn) Nếu user đang mở tab lọc theo loại (ví dụ: ROOM_DISBANDED),
    // chúng ta cũng cần update riêng vào vùng cache của type đó
    newNotifications.forEach((notif) => {
      if (!notif.type) return;

      dispatch(
        notificationsApi.util.updateQueryData(
          "getNotifications",
          { page: 1, type: notif.type }, // Key sẽ là "getNotifications-{TYPE}-all"
          (draft) => {
            draft.items.unshift(notif);
            draft.total += 1;
          },
        ),
      );
    });
  };

  const updateUnreadNotificationBadge = (state: boolean) => {
    dispatch(
      usersApi.util.updateQueryData("getMe", undefined, (draft) => {
        if (draft) {
          draft.hasUnreadNotifications = state;
        }
      }),
    );
  };

  return { addNotificationsToCache, updateUnreadNotificationBadge };
}
