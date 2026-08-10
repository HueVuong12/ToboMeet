import { useDispatch } from "react-redux";
import { AppDispatch } from "../lib/redux/store";
import { NotificationResponse } from "@tobomeet/shared/types";
import { notificationsApi } from "../lib/redux/features/notifications/notificationsApi";
import { usersApi } from "../lib/redux/features/users/usersApi";

export function useNotificationCacheManager() {
  const dispatch = useDispatch<AppDispatch>();

  const addNotificationsToCache = (
    newNotifications: NotificationResponse[],
  ) => {
    if (!newNotifications || newNotifications.length === 0) return;

    // Hàm helper dùng chung để xử lý logic ghi đè & xếp lên đầu
    const updateDraftItems = (draft: any, notif: NotificationResponse) => {
      const existingIndex = draft.items.findIndex(
        (item: NotificationResponse) => item._id === notif._id,
      );

      if (existingIndex !== -1) {
        // Đã tồn tại -> Xóa phần tử cũ đi (không tăng total vì số lượng không đổi)
        draft.items.splice(existingIndex, 1);
      } else {
        // Chưa tồn tại -> Tăng tổng số lượng
        draft.total += 1;
      }

      // Đẩy phần tử mới lên đầu mảng
      draft.items.unshift(notif);
    };

    // Cập nhật cache chính (Tab "Tất cả" - không có filter type hay isRead)
    dispatch(
      notificationsApi.util.updateQueryData(
        "getNotifications",
        { page: 1 },
        (draft) => {
          newNotifications.forEach((notif) => {
            updateDraftItems(draft, notif);
          });
        },
      ),
    );

    // Cập nhật cache riêng theo loại (type)
    newNotifications.forEach((notif) => {
      if (!notif.type) return;

      dispatch(
        notificationsApi.util.updateQueryData(
          "getNotifications",
          { page: 1, type: notif.type },
          (draft) => {
            updateDraftItems(draft, notif);
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

  // Đánh dấu đã đọc trong Cache
  const markNotificationsAsReadInCache = (
    unreadIds: string[],
    type?: string,
    isRead?: boolean | string,
  ) => {
    if (!unreadIds || unreadIds.length === 0) return;

    const unreadSet = new Set(unreadIds);

    // Cập nhật đúng vào tab cache đang mở
    dispatch(
      notificationsApi.util.updateQueryData(
        "getNotifications",
        { page: 1, type, isRead },
        (draft) => {
          draft.items.forEach((item) => {
            if (unreadSet.has(item._id)) {
              item.isRead = true;
            }
          });
        },
      ),
    );

    // Nếu đang ở tab lọc (VD: lọc theo type), cần cập nhật đồng thời cho tab "Tất cả"
    if (type || isRead !== undefined) {
      dispatch(
        notificationsApi.util.updateQueryData(
          "getNotifications",
          { page: 1 },
          (draft) => {
            draft.items.forEach((item) => {
              if (unreadSet.has(item._id)) {
                item.isRead = true;
              }
            });
          },
        ),
      );
    }
  };

  return {
    addNotificationsToCache,
    updateUnreadNotificationBadge,
    markNotificationsAsReadInCache,
  };
}
