import { useSearchUsersQuery } from "@/lib/redux/api/usersApi";
import { useState, useEffect, useMemo, useCallback } from "react";
import debounce from "lodash/debounce";

interface UseGlobalUserSearchOptions {
  q: string;
  limit?: number;
  skip?: boolean;
  debounceMs?: number;
}

export function useGlobalUserSearch({
  q,
  limit = 20,
  skip = false,
  debounceMs = 500,
}: UseGlobalUserSearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState(q);
  const [page, setPage] = useState(1);

  // Debounce logic
  const debouncedSetQuery = useMemo(
    () =>
      debounce((query: string) => {
        setDebouncedQuery(query);
      }, debounceMs),
    [debounceMs],
  );

  useEffect(() => {
    debouncedSetQuery(q);
    return () => {
      debouncedSetQuery.cancel();
    };
  }, [q, debouncedSetQuery]);

  // Tự động reset về trang 1 mỗi khi từ khóa tìm kiếm (đã debounce) thay đổi
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  // Ngăn chặn gọi API nếu từ khóa rỗng hoặc skip được truyền vào
  const trimmedQuery = debouncedQuery?.trim() || "";
  const shouldSkip = skip || !trimmedQuery;

  // Gọi RTK Query với page hiện tại và debounced query
  const queryResult = useSearchUsersQuery(
    {
      q: trimmedQuery,
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
    debouncedQuery,
    total: data?.total || 0,
    hasNext: data?.hasNext || false,
    currentPage: page,
    loadMore,
    refresh,
  };
}

