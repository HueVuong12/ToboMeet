import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { Language } from "../../lib/locales";

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<Language>("vi");
  const toggleLanguage = () => {
    setLang(lang === "vi" ? "en" : "vi");
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
          {lang === "vi" ? "VI 🇻🇳" : "EN 🇬🇧"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
