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

  return { addNotificationsToCache, updateUnreadNotificationBadge };
}
