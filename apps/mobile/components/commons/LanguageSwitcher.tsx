import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === "vi" ? "en" : "vi";
    i18n.changeLanguage(nextLang);
  };

  return (
    <View
      className="absolute z-50"
      style={{
        top: Platform.OS === "ios" ? 50 : 20,
        right: 20,
      }}
    >
      <TouchableOpacity
        onPress={toggleLanguage}
        className="bg-white border border-slate-200 rounded-full px-3 py-1.5 flex-row items-center shadow-md"
      >
        <View className="mr-1">
          <Ionicons name="globe-outline" size={14} color="#64748B" />
        </View>
        <Text className="text-slate-600 font-bold text-xs ml-1">
          {i18n.language === "vi" ? "VI 🇻🇳" : "EN 🇬🇧"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
