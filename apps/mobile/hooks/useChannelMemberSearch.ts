import { useGlobalUserSearch } from "./useGlobalUserSearch";

/**
 * Hook tim kiem thanh vien de them vao kenh private.
 * Wrap useGlobalUserSearch voi config phu hop cho Channel invite flow.
 */
export function useChannelMemberSearch(query: string, skip = false) {
  return useGlobalUserSearch(query, {
    pageSize: 20,
    debounceMs: 300,
    minQueryLength: 2,
    skip,
  });
}
