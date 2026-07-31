import { useDispatch } from "react-redux";
import { AppDispatch } from "../lib/redux/store";
import { roomsApi } from "../lib/redux/features/rooms/roomsApi";

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
   * Xóa một thành viên khỏi danh sách thành viên của phòng (getRoomMembers)
   * Sử dụng khi: Có người bị kick khỏi phòng hoặc tự rời phòng
   */
  const removeMemberFromRoomCache = (roomId: string, userId: string) => {
    dispatch(
      roomsApi.util.updateQueryData("getRoomMembers", roomId, (draft) => {
        // Trả về mảng mới đã lọc bỏ thành viên có userId trùng khớp
        return draft.filter((member) => member.userId !== userId);

        // Hoặc bạn cũng có thể dùng splice (mutating draft):
        // const index = draft.findIndex(m => m.userId === userIdToRemove);
        // if (index !== -1) draft.splice(index, 1);
      }),
    );
  };

  /**
   * Thêm một thành viên mới vào danh sách cache
   */
  const addMemberToRoomCache = (roomId: string, newMember: any) => {
    dispatch(
      roomsApi.util.updateQueryData("getRoomMembers", roomId, (draft) => {
        // Kiểm tra xem đã tồn tại chưa để tránh bị lặp (phòng trường hợp event chạy 2 lần)
        const isExists = draft.some((m) => m.userId === newMember.userId);
        if (!isExists) {
          draft.push(newMember); // Đẩy thẳng user mới vào cuối danh sách
        }
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

  /**
   * Làm mới dữ liệu của một phòng cụ thể (kèm thành viên, kênh thuộc phòng đó)
   */
  const invalidateRoom = (roomId: string) => {
    dispatch(roomsApi.util.invalidateTags([{ type: "Room", id: roomId }]));
  };

  return {
    removeRoomFromMyList,
    removeMemberFromRoomCache,
    addMemberToRoomCache,
    updateRoomDetailsCache,
    invalidateRoomList,
    invalidateRoom,
  };
}
