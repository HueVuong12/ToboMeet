import { useState, useEffect, useCallback } from "react";
import { useGetNotificationsQuery } from "@/lib/redux/api/notificationsApi";

interface UseNotificationsOptions {
  limit?: number;
  type?: string;
  isRead?: boolean | string;
  skip?: boolean;
}

// Hook nhận thông báo và xử lý phân trang
export function useNotifications({
  limit = 20,
  type,
  isRead,
  skip,
}: UseNotificationsOptions = {}) {
  const [page, setPage] = useState(1);

  // Tự động reset về trang 1 mỗi khi các tham số lọc thay đổi
  useEffect(() => {
    setPage(1);
  }, [type, isRead]);

  // Gọi RTK Query với page hiện tại và các tham số lọc
  const queryResult = useGetNotificationsQuery(
    {
      page,
      limit,
      type,
      isRead,
    },
    { skip: skip },
  );

  const { data, isFetching } = queryResult;

  // Hàm gọi trang tiếp theo (Load More)
  const loadMore = useCallback(() => {
    if (data?.hasNext && !isFetching) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [data?.hasNext, isFetching]);

  // Hàm làm mới danh sách (Pull to refresh)
  const refresh = useCallback(() => {
    setPage(1);
    queryResult.refetch();
  }, [queryResult]);

  return {
    ...queryResult, // Trả về tất cả các cờ như isLoading, isFetching, isError,...
    notifications: data?.items || [],
    total: data?.total || 0,
    hasNext: data?.hasNext || false,
    currentPage: page,
    loadMore,
    refresh,
  };
}
