import { useGetMeetingSessionsQuery } from "@/lib/redux/api/meetingsApi";
import { useState, useEffect, useCallback } from "react";
import { MeetingSessionResponse } from "@tobomeet/shared/types";

export interface UseFetchMeetingSessionOptions {
  meetingCode?: string;
  limit?: number;
  skip?: boolean;
}

export function useFetchMeetingSession({
  meetingCode = "",
  limit = 50,
  skip = false,
}: UseFetchMeetingSessionOptions) {
  const [page, setPage] = useState(1);

  // Tự động reset về trang 1 mỗi khi meetingCode thay đổi
  useEffect(() => {
    setPage(1);
  }, [meetingCode]);

  // Ngăn chặn gọi API nếu meetingCode rỗng hoặc cờ skip = true
  const trimmedMeetingCode = meetingCode?.trim() || "";
  const shouldSkip = skip || !trimmedMeetingCode;

  // Gọi RTK Query với page hiện tại và meetingCode
  const queryResult = useGetMeetingSessionsQuery(
    {
      meetingCode: trimmedMeetingCode,
      page,
      limit,
    },
    { skip: shouldSkip },
  );

  const { data, isFetching } = queryResult;
  const sessions: MeetingSessionResponse[] = data?.items || [];

  // Đang tải trang đầu tiên
  const isInitialLoading = !shouldSkip && isFetching && page === 1;

  // Đang tải thêm trang tiếp theo (Load more: page > 1)
  const isLoadingMore = !shouldSkip && isFetching && page > 1;

  // Hàm gọi trang tiếp theo (Load More)
  const loadMore = useCallback(() => {
    if (data?.hasNext && !isFetching) {
      setPage((prevPage) => prevPage + 1);
    }
  }, [data?.hasNext, isFetching]);

  // Hàm làm mới danh sách
  const refresh = useCallback(() => {
    setPage(1);
    queryResult.refetch();
  }, [queryResult]);

  return {
    ...queryResult, // Bao gồm isLoading, isError, isSuccess, error, refetch,...
    sessions,
    total: data?.total || 0,
    hasNext: data?.hasNext || false,
    totalPages: data?.totalPages || 0,
    currentPage: page,
    isInitialLoading,
    isLoadingMore,
    loadMore,
    refresh,
  };
}
