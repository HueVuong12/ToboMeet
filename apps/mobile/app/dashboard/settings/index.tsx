import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../../lib/supabase";
import { router } from "expo-router";
import { toast } from "../../../lib/toast";

export default function SettingsIndexScreen() {
  const { t, i18n } = useTranslation();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Lỗi đăng xuất", error);
      toast.error("Lỗi đăng xuất, vui lòng thử lại sau.");
    }
  };

  const currentLanguageName = i18n.language.startsWith("vi")
    ? t("settings.language.vietnamese") || "Tiếng Việt"
    : t("settings.language.english") || "English (US)";

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-slate-100 flex-row justify-between items-center">
        <Text className="text-xl font-bold text-slate-900">
          {t("settings.title")}
        </Text>
      </View>

      {/* Settings list */}
      <ScrollView className="flex-1 p-6">
        <View className="gap-3">
          {/* Ngôn ngữ */}
          <TouchableOpacity
            onPress={() => router.push("/dashboard/settings/language")}
            className="flex-row items-center justify-between px-5 py-4 rounded-2xl bg-white border border-slate-200/80 active:opacity-70"
          >
            <View className="flex-row items-center gap-4 flex-1">
              <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
                <Feather name="globe" size={20} color="#0052FF" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-sm">
                  {t("settings.tabs.language")}
                </Text>
                <Text className="text-[10px] text-slate-400 mt-0.5">
                  {currentLanguageName}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Quản lý thiết bị */}
          <TouchableOpacity
            onPress={() => router.push("/dashboard/settings/devices")}
            className="flex-row items-center justify-between px-5 py-4 rounded-2xl bg-white border border-slate-200/80 active:opacity-70"
          >
            <View className="flex-row items-center gap-4 flex-1">
              <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
                <Feather name="smartphone" size={20} color="#0052FF" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-sm">
                  {t("settings.tabs.devices")}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Mật khẩu */}
          <TouchableOpacity
            onPress={() => router.push("/dashboard/settings/password")}
            className="flex-row items-center justify-between px-5 py-4 rounded-2xl bg-white border border-slate-200/80 active:opacity-70"
          >
            <View className="flex-row items-center gap-4 flex-1">
              <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center">
                <Feather name="lock" size={20} color="#0052FF" />
              </View>
              <View className="flex-1">
                <Text className="font-bold text-slate-800 text-sm">
                  {t("settings.password.header")}
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout button at the very bottom */}
      <View className="p-6 border-t border-slate-100 bg-white">
        <TouchableOpacity
          onPress={handleLogout}
          className="w-full bg-red-50 py-4 rounded-2xl flex-row justify-center items-center border border-red-100 active:opacity-70"
        >
          <Feather
            name="log-out"
            size={18}
            color="#EF4444"
            style={{ marginRight: 8 }}
          />
          <Text className="text-red-500 font-bold text-sm">
            {t("dashboard.logout")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
