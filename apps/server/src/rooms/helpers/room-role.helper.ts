export type RoomRole = "owner" | "admin" | "member";
export type RoomType = "classroom" | "meeting" | string;

export function getDisplayRole(role: string): string {
  if (!role) return "Thành viên";
  // Normalize legacy roles if present in old data
  const lowerRole = role.toLowerCase();
  let normalizedRole = lowerRole;
  if (["teacher", "leader"].includes(lowerRole)) normalizedRole = "owner";
  else if (["assistant", "vice_leader", "vice", "admin"].includes(lowerRole))
    normalizedRole = "admin";
  else if (["student"].includes(lowerRole)) normalizedRole = "member";

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
  if (!role) return "member";
  const lowerRole = role.toLowerCase();
  if (["teacher", "leader", "owner"].includes(lowerRole)) return "owner";
  if (["assistant", "vice_leader", "admin", "vice"].includes(lowerRole))
    return "admin";
  return "member";
}
