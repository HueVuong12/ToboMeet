import React from "react";
import { View, Text } from "react-native";
import { ShieldCheck, UserCheck, User } from "lucide-react-native";

interface RoleBadgeProps {
  role: string;
  roomType: "classroom" | "meeting" | string;
  t: (key: string, options?: any) => string;
}

export default function RoleBadge({ role, roomType, t }: RoleBadgeProps) {
  const normalizedRole = React.useMemo(() => {
    if (role === "owner") return roomType === "classroom" ? "teacher" : "leader";
    if (role === "admin") return roomType === "classroom" ? "assistant" : "vice_leader";
    if (role === "member" && roomType === "classroom") return "student";
    return role;
  }, [role, roomType]);

  switch (normalizedRole) {
    case "teacher":
      return (
        <View className="flex-row items-center gap-1 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full self-start">
          <ShieldCheck size={12} color="#d97706" />
          <Text className="text-[10px] font-bold text-amber-800">
            {t("room.role_teacher", { defaultValue: "Giáo viên" })}
          </Text>
        </View>
      );
    case "leader":
      return (
        <View className="flex-row items-center gap-1 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full self-start">
          <ShieldCheck size={12} color="#d97706" />
          <Text className="text-[10px] font-bold text-amber-800">
            {t("room.role_leader", { defaultValue: "Trưởng nhóm" })}
          </Text>
        </View>
      );
    case "assistant":
      return (
        <View className="flex-row items-center gap-1 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full self-start">
          <UserCheck size={12} color="#2563eb" />
          <Text className="text-[10px] font-bold text-blue-800">
            {t("room.role_assistant", { defaultValue: "Ban cán sự" })}
          </Text>
        </View>
      );
    case "vice_leader":
      return (
        <View className="flex-row items-center gap-1 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full self-start">
          <UserCheck size={12} color="#2563eb" />
          <Text className="text-[10px] font-bold text-blue-800">
            {t("room.role_vice_leader", { defaultValue: "Phó nhóm" })}
          </Text>
        </View>
      );
    case "student":
      return (
        <View className="flex-row items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full self-start">
          <User size={11} color="#64748b" />
          <Text className="text-[10px] font-medium text-slate-600">
            {t("room.role_student", { defaultValue: "Học viên" })}
          </Text>
        </View>
      );
    case "member":
    default:
      return (
        <View className="flex-row items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full self-start">
          <User size={11} color="#64748b" />
          <Text className="text-[10px] font-medium text-slate-600">
            {t("room.role_member", { defaultValue: "Thành viên" })}
          </Text>
        </View>
      );
  }
}
