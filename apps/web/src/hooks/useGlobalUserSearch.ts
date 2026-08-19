import { useSearchUsersQuery } from "@/lib/redux/api/usersApi";
import { useState, useEffect, useCallback } from "react";

interface UseGlobalUserSearchOptions {
  q: string;
  limit?: number;
  skip?: boolean;
}

// Tuyệt đối không sửa hook này nữa
export function useGlobalUserSearch({
  q,
  limit = 20,
  skip = false,
}: UseGlobalUserSearchOptions) {
  const [page, setPage] = useState(1);

  // Tự động reset về trang 1 mỗi khi từ khóa tìm kiếm thay đổi
  useEffect(() => {
    setPage(1);
  }, [q]);

  // Ngăn chặn gọi API nếu từ khóa rỗng hoặc skip được truyền vào
  const shouldSkip = skip || !q || q.trim() === "";

  // Gọi RTK Query với page hiện tại và từ khóa
  const queryResult = useSearchUsersQuery(
    {
      q,
      page,
      limit,
    },
    { skip: shouldSkip },
  );

  const { data, isFetching } = queryResult;
  const users = data?.items || [];

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
    ...queryResult, // Trả về isLoading, isFetching, isError,...
    users,
    total: data?.total || 0,
    hasNext: data?.hasNext || false,
    currentPage: page,
    loadMore,
    refresh,
  };
}
