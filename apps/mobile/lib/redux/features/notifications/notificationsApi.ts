import { NotificationResponse, PageResponse } from "@tobomeet/shared/types";
import { baseApi } from "../../api/baseApi";

export type GetNotificationsArgs = {
  page: number;
  limit?: number;
  type?: string;
  isRead?: boolean | string;
};

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      PageResponse<NotificationResponse>,
      GetNotificationsArgs
    >({
      query: (args) => ({
        url: "/notifications",
        params: args, // RTK Query tự động chuyển object thành query string (?page=1&limit=20...)
      }),

      // Chỉ tạo khoá (Cache Key) dựa trên các trường lọc, bỏ qua page và limit
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const typeKey = queryArgs.type || "all";
        const readKey =
          queryArgs.isRead !== undefined ? queryArgs.isRead : "all";

        // Ví dụ key sinh ra: "getNotifications-MEETING_INVITE-false"
        return `${endpointName}-${typeKey}-${readKey}`;
      },

      // Gộp (Merge) dữ liệu mới vào cache cũ
      merge: (currentCache, newItems, { arg }) => {
        if (arg.page === 1) {
          // Nếu gọi lại trang 1 (ví dụ pull to refresh), ghi đè toàn bộ cache
          return newItems;
        }

        // Nếu gọi các trang tiếp theo, nối (push) thêm dữ liệu vào mảng items cũ
        currentCache.items.push(...newItems.items);

        // Cập nhật lại các thông tin phân trang
        currentCache.page = newItems.page;
        currentCache.hasNext = newItems.hasNext;
        currentCache.total = newItems.total;
        currentCache.totalPages = newItems.totalPages;
      },

      // Bắt buộc gọi lại API khi page thay đổi (do cache key không chứa page nên RTK Query sẽ tưởng là đã có data rồi)
      forceRefetch({ currentArg, previousArg }) {
        return currentArg?.page !== previousArg?.page;
      },

      providesTags: ["Notification"],
    }),
  }),
  overrideExisting: true,
});

export const { useGetNotificationsQuery } = notificationsApi;
