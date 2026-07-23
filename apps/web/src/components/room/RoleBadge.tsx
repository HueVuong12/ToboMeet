import React from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, UserCheck, User, Loader2 } from "lucide-react";

interface RoleBadgeProps {
  role: string;
  roomType: "classroom" | "meeting" | string;
}

export default function RoleBadge({ role, roomType }: RoleBadgeProps) {
  const t = useTranslations("room");

  // Normalize legacy roles
  const normalizedRole = React.useMemo(() => {
    if (role === "owner") return roomType === "classroom" ? "teacher" : "leader";
    if (role === "admin") return roomType === "classroom" ? "assistant" : "vice_leader";
    if (role === "member" && roomType === "classroom") return "student";
    return role;
  }, [role, roomType]);

  switch (normalizedRole) {
    case "teacher":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
          {t("role_teacher", { defaultValue: "Giáo viên" })}
        </span>
      );
    case "leader":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
          {t("role_leader", { defaultValue: "Trưởng nhóm" })}
        </span>
      );
    case "assistant":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-sm">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          {t("role_assistant", { defaultValue: "Ban cán sự" })}
        </span>
      );
    case "vice_leader":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 shadow-sm">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          {t("role_vice_leader", { defaultValue: "Phó nhóm" })}
        </span>
      );
    case "student":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <User className="w-3 h-3 text-slate-400" />
          {t("role_student", { defaultValue: "Học viên" })}
        </span>
      );
    case "member":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <User className="w-3 h-3 text-slate-400" />
          {t("role_member", { defaultValue: "Thành viên" })}
        </span>
      );
  }
}
