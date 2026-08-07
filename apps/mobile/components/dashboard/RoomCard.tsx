import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { RoomResponse } from "@tobomeet/shared/types";

// Danh sách các dải màu thanh lịch cho Banner
const CARD_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-teal-600",
];

// Hàm tạo màu ngẫu nhiên nhưng cố định theo ID của phòng
function getColor(id: string) {
  let hash = 0;
  if (!id) return CARD_COLORS[0];
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

interface RoomCardProps {
  item: RoomResponse;
  onPress: () => void;
}

export default function RoomCard({ item, onPress }: RoomCardProps) {
  const { t } = useTranslation();
  const bannerColor = getColor(item._id);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4 shadow-sm"
    >
      {/* Header (Banner) */}
      <View
        className={`h-24 ${bannerColor} p-4 justify-between overflow-hidden relative`}
      >
        {/* Các hình tròn trang trí background */}
        <View className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
        <View className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-black/10" />

        {/* Mã phòng (Room Code Badge) */}
        {item.code && (
          <View className="self-end z-10 bg-black/20 px-2.5 py-1 rounded-full border border-white/10 flex-row items-center gap-1">
            <Feather name="hash" size={10} color="rgba(255,255,255,0.7)" />
            <Text className="text-[10px] text-white/90 font-bold tracking-wider">
              {item.code}
            </Text>
          </View>
        )}

        {/* Chữ cái đại diện tên phòng */}
        <View className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 items-center justify-center z-10 shadow-sm mt-auto">
          <Text className="text-white font-extrabold text-lg">
            {item.name ? item.name.charAt(0).toUpperCase() : "?"}
          </Text>
        </View>
      </View>

      {/* Body Card */}
      <View className="p-4 bg-white">
        {/* Tên phòng */}
        <Text
          className="text-base font-bold text-slate-800 mb-3"
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* Footer info & Nút CTA */}
        <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
          <View className="flex-row items-center gap-4">
            {/* Số lượng thành viên */}
            <View className="flex-row items-center gap-1.5">
              <Feather name="users" size={13} color="#94a3b8" />
              <Text className="text-xs font-medium text-slate-600">
                {item.members?.length || 0}
              </Text>
            </View>

            {/* Số lượng kênh (nếu có) */}
            {item.channels && item.channels.length > 0 && (
              <View className="flex-row items-center gap-1.5">
                <Feather name="layers" size={13} color="#94a3b8" />
                <Text className="text-xs font-medium text-slate-600">
                  {item.channels.length}
                </Text>
              </View>
            )}
          </View>

          {/* Dòng chữ Vào phòng */}
          <View className="flex-row items-center gap-1">
            <Text className="text-[11px] font-semibold text-slate-400">
              {t("dashboard.go_to_room", { defaultValue: "Vào phòng" })}
            </Text>
            <Feather name="arrow-right" size={12} color="#94a3b8" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
