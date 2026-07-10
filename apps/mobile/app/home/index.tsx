import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  TextInput,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { User } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useGetMeQuery } from "../../lib/redux/features/users/usersApi";
import { useGetMyRoomsQuery } from "../../lib/redux/features/rooms/roomsApi";
import { Feather } from "@expo/vector-icons";
import JoinRoomModal from "../../components/JoinRoomModal";
import CreateRoomModal from "../../components/CreateRoomModal";
import SettingsModal from "../../components/SettingsModal";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Modals state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<"groups" | "settings">("groups");

  const { data: profile } = useGetMeQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const { data: rooms, isLoading: isRoomsLoading, refetch: refetchRooms } = useGetMyRoomsQuery();

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        setUser(session.user);
      } else {
        router.replace("/(auth)/login");
      }
    } catch (error: any) {
      Alert.alert("Lỗi tải dữ liệu", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      Alert.alert("Lỗi đăng xuất", error.message);
    }
  };

  const filteredRooms = rooms?.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || isRoomsLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 pt-12">
      {/* Header */}
      <View className="flex-row justify-between items-center px-6 py-4 bg-white border-b border-slate-100">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-blue-100 justify-center items-center overflow-hidden">
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} className="w-full h-full" />
            ) : (
              <Text className="font-bold text-blue-600 text-lg">
                {(profile?.displayName || user?.email || "U").charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text className="text-xs text-slate-400 font-semibold">{t("dashboard.title")}</Text>
            <Text className="text-sm font-bold text-slate-800 truncate max-w-[150px]">
              {profile?.displayName || user?.email?.split("@")[0]}
            </Text>
          </View>
        </View>

        {/* Nút bật/tắt tìm kiếm ở góc phải */}
        <TouchableOpacity
          onPress={() => {
            setIsSearching(!isSearching);
            if (isSearching) {
              setSearchQuery("");
            }
          }}
          className="p-2"
        >
          <Feather name="search" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View className="flex-1">
        {/* Action Row */}
        <View className="p-6 pb-4 gap-4">
          {/* Ô tìm kiếm xuất hiện bên dưới Header khi active */}
          {isSearching && (
            <View className="relative flex-row items-center bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
              <Feather name="search" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("dashboard.search_placeholder")}
                placeholderTextColor="#94A3B8"
                autoFocus
                className="flex-1 text-sm text-slate-800 p-0"
              />
              <TouchableOpacity
                onPress={() => {
                  setIsSearching(false);
                  setSearchQuery("");
                }}
              >
                <Feather name="x" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}
          {/* Join or Create buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowJoinModal(true)}
              className="flex-1 bg-blue-50 border border-blue-100 py-4 rounded-2xl flex-row justify-center items-center gap-2 active:bg-blue-100"
            >
              <Feather name="user-plus" size={16} color="#0052FF" />
              <Text className="text-[#0052FF] font-bold text-xs">
                {t("dashboard.join_team")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              className="flex-1 bg-[#0052FF] py-4 rounded-2xl flex-row justify-center items-center gap-2 active:opacity-90"
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text className="text-white font-bold text-xs">
                {t("dashboard.create_team")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rooms List */}
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          ListEmptyComponent={
            searchQuery !== "" ? (
              <View className="items-center justify-center py-20 gap-4">
                <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center">
                  <Feather name="search" size={24} color="#94A3B8" />
                </View>
                <View className="items-center">
                  <Text className="text-sm font-bold text-slate-800">{t("dashboard.no_results_title")}</Text>
                  <Text className="text-xs text-slate-400 mt-1">{t("dashboard.no_results_desc")}</Text>
                </View>
              </View>
            ) : (
              <View className="items-center justify-center py-20 gap-4">
                <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center">
                  <Feather name="folder" size={24} color="#94A3B8" />
                </View>
                <View className="items-center">
                  <Text className="text-sm font-bold text-slate-800">{t("dashboard.empty_title")}</Text>
                  <Text className="text-xs text-slate-400 mt-1">{t("dashboard.empty_description")}</Text>
                </View>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/room/${item._id}`)}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mb-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center gap-4 flex-1">
                <View className="w-12 h-12 rounded-2xl bg-blue-50 justify-center items-center">
                  <Feather
                    name={item.type === "classroom" ? "book-open" : "video"}
                    size={20}
                    color={item.type === "classroom" ? "#4F46E5" : "#0052FF"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-800 text-sm truncate">{item.name}</Text>
                  <Text className="text-[11px] text-slate-400 mt-1 uppercase font-semibold">
                    Code: {item.code}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Bottom Navigation Bar */}
      <View className="flex-row bg-white border-t border-slate-100 py-2.5 px-12 justify-between items-center shadow-lg">
        {/* Tab Nhóm - Video Icon as requested */}
        <TouchableOpacity
          onPress={() => setActiveBottomTab("groups")}
          className="items-center justify-center flex-1 py-1"
        >
          <Feather
            name="video"
            size={22}
            color={activeBottomTab === "groups" ? "#0052FF" : "#94A3B8"}
          />
          <Text
            className={`text-[10px] font-bold mt-1.5 ${
              activeBottomTab === "groups" ? "text-[#0052FF]" : "text-slate-400"
            }`}
          >
            Nhóm
          </Text>
        </TouchableOpacity>

        {/* Tab Cài đặt - Gear Icon */}
        <TouchableOpacity
          onPress={() => {
            setActiveBottomTab("settings");
            setShowSettingsModal(true);
          }}
          className="items-center justify-center flex-1 py-1"
        >
          <Feather
            name="settings"
            size={22}
            color={activeBottomTab === "settings" ? "#0052FF" : "#94A3B8"}
          />
          <Text
            className={`text-[10px] font-bold mt-1.5 ${
              activeBottomTab === "settings" ? "text-[#0052FF]" : "text-slate-400"
            }`}
          >
            Cài đặt
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <JoinRoomModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={(roomId) => {
          setShowJoinModal(false);
          router.push(`/room/${roomId}`);
        }}
      />

      <CreateRoomModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(roomId) => {
          setShowCreateModal(false);
          router.push(`/room/${roomId}`);
        }}
      />

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setActiveBottomTab("groups"); // Reset back to groups tab when closed
        }}
        onLogout={handleLogout}
      />
    </View>
  );
}
