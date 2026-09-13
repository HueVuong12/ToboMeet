export type RoomRole = "owner" | "admin" | "member";
export type RoomType = "classroom" | "meeting" | string;

export function getDisplayRole(role: string): string {
  if (!role) return "Thành viên";
  const lowerRole = role.toLowerCase();
  switch (lowerRole) {
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
  if (lowerRole === "owner") return "owner";
  if (lowerRole === "admin") return "admin";
  return "member";
}
