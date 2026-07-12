import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useGetSessionsQuery, useRevokeSessionMutation } from "../lib/redux/features/users/usersApi";
import { Feather } from "@expo/vector-icons";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
}

type Tab = "language" | "devices";

export default function SettingsModal({
  visible,
  onClose,
  onLogout,
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("language");

  const { data: sessions, isLoading: isSessionsLoading, refetch } = useGetSessionsQuery(undefined, {
    skip: !visible || activeTab !== "devices",
  });
  const [revokeSession, { isLoading: isRevoking }] = useRevokeSessionMutation();

  const handleLanguageChange = async (newLocale: "vi" | "en") => {
    if (newLocale === i18n.language) return;
    await i18n.changeLanguage(newLocale);
  };

  const handleRevokeSession = async (sessionId: string) => {
    Alert.alert(
      t("settings.devices.header"),
      t("settings.devices.confirm_logout"),
      [
        { text: t("settings.cancel"), style: "cancel" },
        {
          text: "OK",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeSession(sessionId).unwrap();
              refetch();
            } catch {
              Alert.alert("Lỗi", t("settings.devices.logout_failed"));
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/40">
        <TouchableOpacity activeOpacity={1} onPress={onClose} className="absolute inset-0" />

        {/* Dialog Sheet */}
        <View className="bg-white rounded-t-3xl h-[80%] shadow-xl border border-slate-100 flex-col">
          {/* Header */}
          <View className="flex-row justify-between items-center px-6 py-5 border-b border-slate-100">
            <Text className="text-lg font-bold text-slate-900">
              {t("settings.title")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
            >
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Tab Selection */}
          <View className="flex-row border-b border-slate-100 px-4">
            <TouchableOpacity
              onPress={() => setActiveTab("language")}
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === "language" ? "border-[#0052FF]" : "border-transparent"
              }`}
            >
              <Text
                className={`font-bold text-sm ${
                  activeTab === "language" ? "text-[#0052FF]" : "text-slate-500"
                }`}
              >
                {t("settings.tabs.language")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("devices")}
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === "devices" ? "border-[#0052FF]" : "border-transparent"
              }`}
            >
              <Text
                className={`font-bold text-sm ${
                  activeTab === "devices" ? "text-[#0052FF]" : "text-slate-500"
                }`}
              >
                {t("settings.tabs.devices")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <ScrollView className="flex-1 p-6">
            {activeTab === "language" && (
              <View className="gap-6">
                <View>
                  <Text className="text-base font-bold text-slate-800">
                    {t("settings.language.header")}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {t("settings.language.desc")}
                  </Text>
                </View>

                {/* Language list */}
                <View className="gap-3">
                  {/* Vietnamese */}
                  <TouchableOpacity
                    onPress={() => handleLanguageChange("vi")}
                    className={`flex-row items-center justify-between px-5 py-4 rounded-2xl border ${
                      i18n.language === "vi"
                        ? "border-[#0052FF] bg-blue-50/10"
                        : "border-slate-200/80 bg-white"
                    }`}
                  >
                    <View className="flex-row items-center gap-4">
                      <Text className="text-2xl">🇻🇳</Text>
                      <View>
                        <Text className="font-bold text-slate-800">
                          {t("settings.language.vietnamese")}
                        </Text>
                        <Text className="text-[10px] text-slate-400 mt-0.5">Vietnamese</Text>
                      </View>
                    </View>
                    {i18n.language === "vi" ? (
                      <View className="w-5 h-5 rounded-full bg-[#0052FF] items-center justify-center">
                        <Feather name="check" size={12} color="#ffffff" />
                      </View>
                    ) : (
                      <View className="w-5 h-5 rounded-full border border-slate-200" />
                    )}
                  </TouchableOpacity>

                  {/* English */}
                  <TouchableOpacity
                    onPress={() => handleLanguageChange("en")}
                    className={`flex-row items-center justify-between px-5 py-4 rounded-2xl border ${
                      i18n.language === "en"
                        ? "border-[#0052FF] bg-blue-50/10"
                        : "border-slate-200/80 bg-white"
                    }`}
                  >
                    <View className="flex-row items-center gap-4">
                      <Text className="text-2xl">🇺🇸</Text>
                      <View>
                        <Text className="font-bold text-slate-800">
                          {t("settings.language.english")}
                        </Text>
                        <Text className="text-[10px] text-slate-400 mt-0.5">Tiếng Anh (Mỹ)</Text>
                      </View>
                    </View>
                    {i18n.language === "en" ? (
                      <View className="w-5 h-5 rounded-full bg-[#0052FF] items-center justify-center">
                        <Feather name="check" size={12} color="#ffffff" />
                      </View>
                    ) : (
                      <View className="w-5 h-5 rounded-full border border-slate-200" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === "devices" && (
              <View className="gap-6 flex-1">
                <View>
                  <Text className="text-base font-bold text-slate-800">
                    {t("settings.devices.header")}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {t("settings.devices.desc")}
                  </Text>
                </View>

                {/* Device list */}
                <View className="gap-3">
                  {isSessionsLoading ? (
                    <View className="items-center justify-center py-10 gap-3">
                      <ActivityIndicator size="large" color="#0052FF" />
                      <Text className="text-xs text-slate-400 font-semibold">
                        {t("settings.devices.loading")}
                      </Text>
                    </View>
                  ) : !sessions || sessions.length === 0 ? (
                    <View className="items-center justify-center py-10 gap-3">
                      <Feather name="shield-off" size={32} color="#CBD5E1" />
                      <Text className="text-xs text-slate-400 font-semibold">
                        {t("settings.devices.empty")}
                      </Text>
                    </View>
                  ) : (
                    sessions.map((session) => (
                      <View
                        key={session.id}
                        className={`flex-row items-center justify-between p-4 rounded-2xl border ${
                          session.isCurrent
                            ? "border-blue-500/30 bg-blue-50/5"
                            : "border-slate-100 bg-white"
                        }`}
                      >
                        <View className="flex-row items-center gap-4 flex-1">
                          {/* Device Icon */}
                          <View
                            className={`w-10 h-10 rounded-xl items-center justify-center ${
                              session.isCurrent ? "bg-blue-500/10 text-[#0052FF]" : "bg-slate-100"
                            }`}
                          >
                            {session.isMobile ? (
                              <Feather name="smartphone" size={20} color={session.isCurrent ? "#0052FF" : "#64748B"} />
                            ) : (
                              <Feather name="monitor" size={20} color={session.isCurrent ? "#0052FF" : "#64748B"} />
                            )}
                          </View>

                          {/* Device Info */}
                          <View className="flex-1 min-w-0">
                            <View className="flex-row items-center gap-2 flex-wrap">
                              <Text className="font-bold text-slate-800 text-sm truncate">
                                {session.os} • {session.browser}
                              </Text>
                              {session.isCurrent && (
                                <View className="px-2 py-0.5 rounded-full bg-green-50 border border-green-200">
                                  <Text className="text-[9px] font-bold text-green-700">
                                    {t("settings.devices.current_device")}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-[10px] text-slate-400 font-semibold mt-1">
                              IP: {session.ip} • {session.isCurrent ? t("settings.devices.active") : `${t("settings.devices.logged_in_at")}${new Date(session.createdAt).toLocaleDateString()}`}
                            </Text>
                          </View>
                        </View>

                        {/* Revoke button */}
                        {!session.isCurrent && (
                          <TouchableOpacity
                            onPress={() => handleRevokeSession(session.id)}
                            disabled={isRevoking}
                            className="p-2 rounded-xl bg-red-50"
                          >
                            <Feather name="log-out" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Logout button at the very bottom */}
          <View className="p-6 border-t border-slate-100">
            <TouchableOpacity
              onPress={() => {
                onClose();
                onLogout();
              }}
              className="w-full bg-red-50 py-4 rounded-2xl flex-row justify-center items-center border border-red-100"
            >
              <Feather name="log-out" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text className="text-red-500 font-bold text-sm">
                {t("dashboard.logout")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
