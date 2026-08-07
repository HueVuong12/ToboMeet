import React from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, UserCheck, User, Loader2 } from "lucide-react";

interface RoleBadgeProps {
  role: string;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const t = useTranslations("room");

  // Normalize roles to owner, admin, member
  const normalizedRole = React.useMemo(() => {
    if (["owner", "teacher", "leader"].includes(role)) return "owner";
    if (["vice", "vice_leader", "assistant", "admin"].includes(role))
      return "admin";
    return "member";
  }, [role]);

  const badgeText = React.useMemo(() => {
    if (normalizedRole === "owner")
      return t("role_leader", { defaultValue: "Trưởng nhóm" });
    if (normalizedRole === "admin")
      return t("role_vice_leader", {
        defaultValue: "Phó nhóm",
      });
    return t("role_member", { defaultValue: "Thành viên" });
  }, [normalizedRole, t]);

  switch (normalizedRole) {
    case "owner":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
          {badgeText}
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-sm">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          {badgeText}
        </span>
      );
    case "member":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <User className="w-3 h-3 text-slate-400" />
          {badgeText}
        </span>
      );
  }
}
