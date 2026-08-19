import { useState, useEffect, useMemo } from "react";
import { useSearchUsersPaginatedQuery } from "../lib/redux/features/users/usersApi";
import { UserResponse } from "@tobomeet/shared/types";

export interface UseGlobalUserSearchOptions {
  pageSize?: number;
  debounceMs?: number;
  skip?: boolean;
  minQueryLength?: number;
}

export interface UseGlobalUserSearchReturn {
  users: UserResponse[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
  activeQuery: string;
  hasResults: boolean;
  isEmpty: boolean;
}

/**
 * Hook nen tang tim kiem nguoi dung toan he thong.
 * - Debounce tich hop 300ms
 * - Phan trang client-side
 * - Khong sua hook nay; hay tao hook wrap cho tung nghiep vu
 */
export function useGlobalUserSearch(
  query: string,
  options: UseGlobalUserSearchOptions = {}
): UseGlobalUserSearchReturn {
  const {
    pageSize = 20,
    debounceMs = 300,
    skip = false,
    minQueryLength = 2,
  } = options;

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed !== debouncedQuery) {
        setDebouncedQuery(trimmed);
        setPage(1);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const shouldSkip =
    skip || !debouncedQuery || debouncedQuery.length < minQueryLength;

  const { data, isFetching } = useSearchUsersPaginatedQuery(
    { q: debouncedQuery },
    { skip: shouldSkip }
  );

  const { pagedUsers, totalPages } = useMemo(() => {
    const allUsers = data?.users ?? [];
    const total = allUsers.length;
    const totalPagesCalc = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPagesCalc);
    const start = (safePage - 1) * pageSize;
    const pagedUsers = allUsers.slice(start, start + pageSize);
    return { pagedUsers, totalPages: totalPagesCalc };
  }, [data, page, pageSize]);

  const total = data?.total ?? 0;
  const hasResults = pagedUsers.length > 0;
  const isEmpty = !isFetching && !!debouncedQuery && debouncedQuery.length >= minQueryLength && !hasResults;

  return {
    users: pagedUsers,
    isLoading: isFetching,
    page,
    totalPages,
    total,
    setPage,
    activeQuery: debouncedQuery,
    hasResults,
    isEmpty,
  };
}
