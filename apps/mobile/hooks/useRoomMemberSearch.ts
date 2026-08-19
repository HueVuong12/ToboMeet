import { useGlobalUserSearch } from "./useGlobalUserSearch";

/**
 * Hook tim kiem thanh vien de moi vao Room.
 * Wrap useGlobalUserSearch voi config phu hop cho Room invite flow.
 */
export function useRoomMemberSearch(query: string, skip = false) {
  return useGlobalUserSearch(query, {
    pageSize: 20,
    debounceMs: 300,
    minQueryLength: 2,
    skip,
  });
}
