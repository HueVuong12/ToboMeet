import { RoomResponse } from "@tobomeet/shared/types";
import { RoomDocument } from "../schemas/room.schema";
import { RoomMember } from "../schemas/room-member.schema";
import { getDisplayRole } from "./room-role.helper";

/**
 * Bộ chuyển đổi: Mongoose Document -> RoomResponse chuẩn
 * Đảm bảo đồng bộ kiểu dữ liệu với frontend, tránh lộ thông tin nhạy cảm
 */
export function mapToRoomResponse(room: RoomDocument): RoomResponse {
  // Chuyển Mongoose Document thành plain JavaScript Object
  const plainRoom = room.toObject ? room.toObject() : (room as any);

  const safeToIsoString = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) return val.toISOString();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  const activeRoomMembers =
    plainRoom.members
      ?.filter((m: RoomMember) => m.status !== "remove" && m.status !== "left")
      .map((m: RoomMember) => {
        return {
          userId: m.userId,
          role: m.role,
          displayRole: getDisplayRole(m.role || "member", plainRoom.type),
          joinedAt: safeToIsoString(m.joinedAt),
        };
      }) || [];

  const mappedChannels =
    plainRoom.channels?.map((c: any) => {
      // Đối với kênh công khai, tự động map toàn bộ thành viên của room làm thành viên kênh
      if (c.isPrivate !== true) {
        const specialMembers = c.members || [];
        const fullMembers = activeRoomMembers.map((rm: any) => {
          const special = specialMembers.find(
            (sm: any) => sm.userId === rm.userId,
          );
          return {
            userId: rm.userId,
            role: special ? special.role : "member",
          };
        });
        return {
          ...c,
          _id: c._id?.toString() || "",
          members: fullMembers,
        };
      }
      return {
        ...c,
        _id: c._id?.toString() || "",
        members: c.members || [],
      };
    }) || [];

  return {
    _id: plainRoom._id?.toString() || "",
    name: plainRoom.name || "",
    type: (plainRoom.type || "meeting") as "meeting" | "classroom",
    code: plainRoom.code || "",
    ownerId: plainRoom.ownerId || "",
    channels: mappedChannels,
    members: activeRoomMembers,
    createdAt: safeToIsoString(plainRoom.createdAt),
    updatedAt: safeToIsoString(plainRoom.updatedAt),
  };
}
