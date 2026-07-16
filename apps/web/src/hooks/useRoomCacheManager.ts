import { useDispatch } from "react-redux";
import { roomsApi } from "@/lib/redux/api/roomsApi";
import { AppDispatch } from "@/lib/redux/store";

export function useRoomCacheManager() {
  const dispatch = useDispatch<AppDispatch>();

  /**
   * Xóa một phòng khỏi danh sách phòng của tôi (getMyRooms)
   * Sử dụng khi: Người dùng bị kick, hoặc phòng bị giải tán
   */
  const removeRoomFromMyList = (roomId: string) => {
    dispatch(
      roomsApi.util.updateQueryData("getMyRooms", undefined, (draft) => {
        // Lọc bỏ phòng có ID trùng với roomIdToRemove
        return draft.filter((room: any) => room._id !== roomId);
      }),
    );
  };

  /**
   * Xóa hoặc cập nhật thông tin chi tiết của một phòng cụ thể
   * Sử dụng khi: Có người mới vào phòng, đổi tên phòng, v.v.
   */
  const updateRoomDetailsCache = (roomId: string, updateData: any) => {
    dispatch(
      roomsApi.util.updateQueryData("getRoomById", roomId, (draft) => {
        // Áp dụng các thay đổi vào draft (Immer.js sẽ tự lo phần immutable)
        Object.assign(draft, updateData);
      }),
    );
  };

  /**
   * Ép RTK Query gọi lại API để làm mới toàn bộ danh sách phòng
   * Sử dụng khi: Dữ liệu quá cũ hoặc có quá nhiều thay đổi phức tạp
   */
  const invalidateRoomList = () => {
    dispatch(roomsApi.util.invalidateTags(["Room"]));
  };

  return {
    removeRoomFromMyList,
    updateRoomDetailsCache,
    invalidateRoomList,
  };
}
