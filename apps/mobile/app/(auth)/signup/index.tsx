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
import { supabaseAuth } from "../../../lib/supabase";
import { validatePasswordPolicy } from "@tobomeet/shared/utils";
import { Language, translations } from "../../../lib/locales";
import { renderConstraintRow } from "../forgot-password";

export default function SignupScreen() {
  const router = useRouter();

  const [lang, setLang] = useState<Language>("vi");
  const t = translations[lang];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFbLoading, setIsFbLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── SỬ DỤNG HÀM VALIDATE CHUNG TỪ GÓI SHARED ──
  const {
    hasMinLength,
    hasLetter,
    hasUpper,
    hasLower,
    hasNumber,
    noConsecutive,
    isValid: passwordValid,
  } = validatePasswordPolicy(password);

  // ── XỬ LÝ ĐĂNG KÝ ──
  const handleSignup = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!email || !password || !confirmPassword) {
      setErrorMsg("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (!passwordValid) {
      setErrorMsg("Vui lòng đáp ứng tất cả các điều kiện mật khẩu.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await supabaseAuth.signUp(email, password);

      if (result.requiresEmailConfirmation) {
        setSuccessMsg("Vui lòng kiểm tra hộp thư email để xác nhận tài khoản.");
      } else {
        // Đăng ký xong có session luôn (nếu tắt xác nhận email)
        router.replace("/(tabs)/home");
      }
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
      await supabaseAuth.signInWithOAuth(provider);
    } catch (error: unknown) {
      setErrorMsg(
        error instanceof Error ? error.message : t.errorSendOtpFailed,
      );
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
          paddingTop: 50,
          paddingBottom: 50,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 w-full max-w-md mx-auto">
          <View className="text-center mb-6 items-center">
            <Text className="text-2xl font-bold text-slate-900 mb-2">
              Đăng ký tài khoản
            </Text>
            <Text className="text-slate-500 text-sm">
              Tạo tài khoản để tiếp tục
            </Text>
          </View>

          {/* Lỗi */}
          {errorMsg ? (
            <View className="mb-5 p-3.5 bg-red-50 rounded-2xl border border-red-100 flex-row items-center">
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text className="text-red-500 text-xs font-medium ml-2 flex-1">
                {errorMsg}
              </Text>
            </View>
          ) : null}

          {/* Thành công (Yêu cầu check email) */}
          {successMsg ? (
            <View className="mb-5 p-3.5 bg-green-50 rounded-2xl border border-green-100 flex-row items-center">
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text className="text-green-700 text-xs font-medium ml-2 flex-1">
                {successMsg}
              </Text>
            </View>
          ) : null}

          <View className="gap-4">
            {/* Input Email */}
            <View>
              <Text className="block mb-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Email công việc
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
              <Text className="block mb-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Mật khẩu
              </Text>
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

            {/* BẢNG ĐIỀU KIỆN MẬT KHẨU */}
            <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-4">
              <Text className="text-slate-800 font-bold text-sm mb-3">
                {t.reqTitle}
              </Text>
              {renderConstraintRow(t.reqMinLength, hasMinLength)}
              {renderConstraintRow(t.reqLetters, hasLetter)}
              {renderConstraintRow(t.reqUppercase, hasUpper)}
              {renderConstraintRow(t.reqLowercase, hasLower)}
              {renderConstraintRow(t.reqNumbers, hasNumber)}
              <View className="h-px bg-slate-200 my-3" />
              <Text className="text-slate-800 font-bold text-sm mb-2">
                {t.ruleTitle}
              </Text>
              {renderConstraintRow(t.ruleConsecutive, noConsecutive)}
            </View>

            {/* Input Xác nhận mật khẩu */}
            <View>
              <Text className="block mb-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Xác nhận mật khẩu
              </Text>
              <View
                className={`w-full border rounded-2xl px-4 py-3.5 flex-row items-center bg-slate-50 ${
                  focusedInput === "confirm"
                    ? "border-[#0052FF] bg-white"
                    : "border-slate-200"
                }`}
              >
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  onFocus={() => setFocusedInput("confirm")}
                  onBlur={() => setFocusedInput(null)}
                  className="flex-1 text-slate-900"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(!showConfirm)}
                  className="pl-3"
                >
                  <Ionicons
                    name={showConfirm ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSignup}
              disabled={isLoading || (password.length > 0 && !passwordValid)}
              className={`w-full mt-2 py-4 rounded-full flex-row justify-center items-center gap-2 shadow-sm ${
                isLoading || (password.length > 0 && !passwordValid)
                  ? "opacity-50"
                  : "active:opacity-90"
              }`}
              style={{ backgroundColor: "#0052FF" }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-[15px]">
                  Đăng ký
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-8 mb-6">
            <Text className="text-sm text-slate-500 font-medium">
              Bạn đã có tài khoản?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text className="text-sm text-[#0052FF] font-bold">
                Đăng nhập
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-3 mb-6">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-xs font-semibold text-slate-400 uppercase">
              HOẶC
            </Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          <View className="gap-3">
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
