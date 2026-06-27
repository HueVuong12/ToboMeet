import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Lấy thông tin user ngay khi màn hình vừa bật lên
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
        // Nếu không có session, "đá" người dùng về lại trang login
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

  // Màn hình loading trong lúc chờ Supabase trả dữ liệu
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#0052FF" />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center bg-slate-50 p-6">
      <View className="bg-white p-6 rounded-3xl w-full max-w-md shadow-sm border border-slate-100 items-center">
        <Text className="text-xl font-bold text-slate-800 mb-2">
          🎉 Đăng nhập thành công!
        </Text>

        {/* Khối hiển thị thông tin User */}
        <View className="w-full bg-slate-50 p-4 rounded-xl mt-4 border border-slate-100">
          <Text className="text-xs text-slate-500 font-semibold mb-1 uppercase">
            Email của bạn
          </Text>
          <Text className="text-base text-slate-800 font-medium mb-3">
            {user?.email || "Không có email"}
          </Text>

          <Text className="text-xs text-slate-500 font-semibold mb-1 uppercase">
            User ID
          </Text>
          <Text className="text-xs text-slate-800 font-medium">{user?.id}</Text>
        </View>

        {/* Nút Đăng xuất */}
        <TouchableOpacity
          onPress={handleLogout}
          className="w-full mt-6 bg-red-50 py-4 rounded-full flex-row justify-center items-center border border-red-100 active:bg-red-100"
        >
          <Text className="text-red-500 font-bold text-[15px]">Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
