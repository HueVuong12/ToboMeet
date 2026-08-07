export type RoomRole = "owner" | "admin" | "member";
export type RoomType = "classroom" | "meeting" | string;

export function getDisplayRole(role: string): string {
  // Normalize legacy roles if present in old data
  let normalizedRole = role;
  if (["teacher", "leader"].includes(role)) normalizedRole = "owner";
  else if (["assistant", "vice_leader", "vice", "admin"].includes(role))
    normalizedRole = "admin";
  else if (["student"].includes(role)) normalizedRole = "member";

  // Default to meeting room format
  switch (normalizedRole) {
    case "owner":
      return "Trưởng nhóm";
    case "admin":
      return "Phó nhóm";
    case "member":
    default:
      return "Thành viên";
  }
}

export function normalizeRole(role: string): RoomRole {
  if (["teacher", "leader", "owner"].includes(role)) return "owner";
  if (["assistant", "vice_leader", "admin", "vice"].includes(role))
    return "admin";
  return "member";
}
