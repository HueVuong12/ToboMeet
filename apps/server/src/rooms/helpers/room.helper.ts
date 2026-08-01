import { RoomResponse } from "@tobomeet/shared/types";
import { RoomMember } from "../schemas/room-member.schema";
import { RoomDocument } from "../schemas/room.schema";
import { getDisplayRole } from "./room-role.helper";

export function mapToRoomResponse(room: RoomDocument): RoomResponse {
  const plainRoom = room.toObject?.() ?? room;

  const safeToIsoString = (value: unknown): string => {
    if (!value) return new Date().toISOString();

    const date = value instanceof Date ? value : new Date(value as string);

    return isNaN(date.getTime())
      ? new Date().toISOString()
      : date.toISOString();
  };

  const activeRoomMembers =
    plainRoom.members
      ?.filter(
        (member: RoomMember) =>
          member.status !== "remove" && member.status !== "left",
      )
      .map((member: RoomMember) => ({
        userId: member.userId,
        role: member.role,
        displayRole: getDisplayRole(member.role ?? "member", plainRoom.type),
        joinedAt: safeToIsoString(member.joinedAt),
      })) ?? [];

  return {
    _id: plainRoom._id?.toString() ?? "",
    name: plainRoom.name ?? "",
    type: (plainRoom.type ?? "meeting") as "meeting" | "classroom",
    code: plainRoom.code ?? "",
    ownerId: plainRoom.ownerId ?? "",
    channels:
      plainRoom.channels?.map((channel: any) => {
        if (channel.isPrivate) {
          return {
            ...channel,
            _id: channel._id?.toString() ?? "",
            members: channel.members ?? [],
          };
        }

        const memberRoles = new Map(
          (channel.members ?? []).map((member: any) => [
            member.userId,
            member.role,
          ]),
        );

        return {
          ...channel,
          _id: channel._id?.toString() ?? "",
          members: activeRoomMembers.map((member) => ({
            userId: member.userId,
            role: memberRoles.get(member.userId) ?? "member",
          })),
        };
      }) ?? [],
    members: activeRoomMembers,
    createdAt: safeToIsoString(plainRoom.createdAt),
    updatedAt: safeToIsoString(plainRoom.updatedAt),
  };
}
