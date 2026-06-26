import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, supabaseAuth } from "../../../lib/supabase";
import { translations, Language } from "../../../lib/locales";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();

  const [lang, setLang] = useState<Language>("vi");
  const t = translations[lang];

  // State quản lý form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFbLoading, setIsFbLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Trạng thái focus để đổi màu viền Input
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    try {
      await supabaseAuth.signInWithPassword(email, password);
      // Đăng nhập thành công, Supabase tự lưu session, chuyển hướng về Home
      router.replace("/(tabs)/home");
    } catch (error: unknown) {
      setErrorMsg(
        error instanceof Error ? error.message : t.errorSendOtpFailed,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    if (provider === "google") setIsGoogleLoading(true);
    else setIsFbLoading(true);

    setErrorMsg("");

    try {
      // 1. Tạo URL quay về app (Phải khớp với Redirect URL trong Supabase)
      // Ví dụ: tobomeet://auth/callback
      const redirectUrl = Linking.createURL("tobomeet://auth/callback");

      // 2. Lấy URL đăng nhập từ Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // Thêm dòng này để kiểm soát việc mở browser
        },
      });

      if (error) throw error;

      // 3. Mở trình duyệt an toàn (Expo WebBrowser)
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl, // Đường dẫn sẽ được kiểm tra để đóng trình duyệt khi khớp
      );

      // 4. Xử lý kết quả
      if (result.type === "success") {
        // Lưu ý: Không cần router.replace ở đây nếu bạn đã có file callback.tsx
        // SDK Supabase sẽ tự động cập nhật session khi quay về.
        // Chỉ cần router.replace nếu bạn muốn chủ động điều hướng sau khi check xong.
      } else {
        throw new Error("Đăng nhập bị hủy hoặc thất bại");
      }
    } catch (error: any) {
      setErrorMsg(error.message || "Lỗi đăng nhập");
    } finally {
      if (provider === "google") setIsGoogleLoading(false);
      else setIsFbLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 w-full max-w-md mx-auto">
          {/* LOGO TOBOMEET */}
          <View className="flex-row justify-center items-center mb-8">
            <View className="w-10 h-10 bg-brand-500 rounded-xl items-center justify-center mr-3 shadow-sm bg-[#0052FF]">
              <Ionicons name="videocam" size={22} color="white" />
            </View>
            <Text className="text-3xl font-black text-slate-800 tracking-tight">
              Tobo<Text className="text-[#0052FF]">Meet</Text>
            </Text>
          </View>

          {/* TIÊU ĐỀ */}
          <View className="text-center mb-6 items-center">
            <Text className="text-2xl font-bold text-slate-900 mb-2">
              Chào mừng trở lại
            </Text>
            <Text className="text-slate-500 text-sm">
              Đăng nhập để tiếp tục
            </Text>
          </View>

          {/* HIỂN THỊ LỖI */}
          {errorMsg ? (
            <View className="mb-6 p-3.5 bg-red-50 rounded-2xl border border-red-100 flex-row items-center">
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text className="text-red-500 text-xs font-medium ml-2 flex-1">
                {errorMsg}
              </Text>
            </View>
          ) : null}

          {/* NÚT ĐĂNG NHẬP MẠNG XÃ HỘI */}
          <View className="gap-3 mb-6">
            <TouchableOpacity
              onPress={() => handleOAuthLogin("google")}
              disabled={isGoogleLoading || isFbLoading || isLoading}
              className="w-full flex-row items-center justify-center gap-3 px-4 py-3.5 border border-slate-200 rounded-full active:bg-slate-50"
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <Ionicons name="logo-google" size={20} color="#DB4437" />
              )}
              <Text className="font-medium text-slate-700">
                Tiếp tục với Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleOAuthLogin("facebook")}
              disabled={isGoogleLoading || isFbLoading || isLoading}
              className="w-full flex-row items-center justify-center gap-3 px-4 py-3.5 border border-slate-200 rounded-full active:bg-slate-50"
            >
              {isFbLoading ? (
                <ActivityIndicator size="small" color="#1877F2" />
              ) : (
                <Ionicons name="logo-facebook" size={20} color="#1877F2" />
              )}
              <Text className="font-medium text-slate-700">
                Tiếp tục với Facebook
              </Text>
            </TouchableOpacity>
          </View>

          {/* DẢI PHÂN CÁCH "HOẶC" */}
          <View className="flex-row items-center gap-3 mb-6">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-xs font-semibold text-slate-400 uppercase">
              HOẶC
            </Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          {/* FORM ĐĂNG NHẬP EMAIL */}
          <View className="gap-5">
            {/* Input Email */}
            <View>
              <Text className="block mb-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="nhap@email.com"
                placeholderTextColor="#94A3B8"
                onFocus={() => setFocusedInput("email")}
                onBlur={() => setFocusedInput(null)}
                className={`w-full px-4 py-3.5 bg-slate-50 border rounded-2xl text-slate-900 ${
                  focusedInput === "email"
                    ? "border-[#0052FF] bg-white"
                    : "border-slate-200"
                }`}
              />
            </View>

            {/* Input Mật khẩu */}
            <View>
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Mật khẩu
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/forgot-password")}
                >
                  <Text className="text-xs font-medium text-[#0052FF]">
                    Quên mật khẩu?
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                className={`w-full border rounded-2xl px-4 py-3.5 flex-row items-center bg-slate-50 ${
                  focusedInput === "password"
                    ? "border-[#0052FF] bg-white"
                    : "border-slate-200"
                }`}
              >
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  onFocus={() => setFocusedInput("password")}
                  onBlur={() => setFocusedInput(null)}
                  className="flex-1 text-slate-900"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="pl-3"
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nút Submit */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading || !email || !password}
              className={`w-full mt-2 py-4 rounded-full flex-row justify-center items-center gap-2 shadow-sm ${
                isLoading || !email || !password
                  ? "opacity-70"
                  : "active:opacity-90"
              }`}
              style={{ backgroundColor: "#0052FF" }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-[15px]">
                  Đăng nhập
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Đăng ký */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-sm text-slate-500 font-medium">
              Bạn chưa có tài khoản?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
              <Text className="text-sm text-[#0052FF] font-bold">
                Đăng ký ngay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
