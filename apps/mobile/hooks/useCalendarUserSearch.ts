import { useGlobalUserSearch } from "./useGlobalUserSearch";

/**
 * Hook tim kiem nguoi dung de moi vao su kien lich.
 * Wrap useGlobalUserSearch voi config phu hop cho Calendar EventModal.
 */
export function useCalendarUserSearch(query: string, skip = false) {
  return useGlobalUserSearch(query, {
    pageSize: 20,
    debounceMs: 300,
    minQueryLength: 2,
    skip,
  });
}
