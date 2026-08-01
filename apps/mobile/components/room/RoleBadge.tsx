import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

interface RoleBadgeProps {
  role: string;
  displayRole?: string;
  roomType: "classroom" | "meeting" | string;
  t: (key: string, options?: any) => string;
}

export default function RoleBadge({
  role,
  displayRole,
  roomType,
  t,
}: RoleBadgeProps) {
  const normalizedRole = React.useMemo(() => {
    if (["owner", "teacher", "leader"].includes(role)) return "owner";
    if (["vice", "vice_leader", "assistant", "admin"].includes(role))
      return "admin";
    return "member";
  }, [role]);

  const defaultText = React.useMemo(() => {
    if (displayRole) return displayRole;
    if (roomType === "classroom") {
      if (normalizedRole === "owner")
        return t("room.role_teacher", { defaultValue: "Giảng viên" });
      if (normalizedRole === "admin")
        return t("room.role_assistant", { defaultValue: "Ban cán sự" });
      return t("room.role_student", { defaultValue: "Học viên" });
    } else {
      if (normalizedRole === "owner")
        return t("room.role_leader", { defaultValue: "Trưởng nhóm" });
      if (normalizedRole === "admin")
        return t("room.role_vice_leader", { defaultValue: "Phó nhóm" });
      return t("room.role_member", { defaultValue: "Thành viên" });
    }
  }, [displayRole, normalizedRole, roomType, t]);

  switch (normalizedRole) {
    case "owner":
      return (
        <View className="flex-row items-center gap-1 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full self-start">
          <Feather name="shield" size={11} color="#d97706" />
          <Text className="text-[10px] font-bold text-amber-800">
            {defaultText}
          </Text>
        </View>
      );
    case "admin":
      return (
        <View className="flex-row items-center gap-1 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full self-start">
          <Feather name="user-check" size={11} color="#2563eb" />
          <Text className="text-[10px] font-bold text-blue-800">
            {defaultText}
          </Text>
        </View>
      );
    case "member":
    default:
      return (
        <View className="flex-row items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full self-start">
          <Feather name="user" size={11} color="#64748b" />
          <Text className="text-[10px] font-medium text-slate-600">
            {defaultText}
          </Text>
        </View>
      );
  }
}
