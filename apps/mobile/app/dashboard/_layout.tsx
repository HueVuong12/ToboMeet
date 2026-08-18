// app/dashboard/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

export default function DashboardLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Ẩn header mặc định của Tabs vì chúng ta đã tự code header trong mỗi trang
        tabBarActiveTintColor: "#0052FF",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: "#f1f5f9",
          backgroundColor: "#ffffff",
          elevation: 0, // Bỏ bóng mờ trên Android để giao diện phẳng hơn
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "bold",
        },
      }}
    >
      {/* Tab 1: Ánh xạ vào file index.tsx */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("dashboard.tab_rooms"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="video" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 2: Ánh xạ vào file calendar.tsx */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: t("dashboard.tab_calendar"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 3: Ánh xạ vào file settings.tsx */}
      <Tabs.Screen
        name="settings"
        options={{
          title: t("dashboard.tab_settings"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
