import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { translations, Language } from '../../../lib/locales';
import { supabaseAuth } from '../../../lib/supabase';

type FormStep = 'email' | 'otp' | 'reset' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  // Đa ngôn ngữ
  const [lang, setLang] = useState<Language>('vi');
  const t = translations[lang];

  const [step, setStep] = useState<FormStep>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Trạng thái focus của các input để làm hiệu ứng viền màu xanh
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Access token tạm thời sau khi xác thực OTP từ Supabase
  const [accessToken, setAccessToken] = useState('');

  // Ràng buộc mật khẩu (real-time)
  const isMinLength = newPassword.length >= 8;
  const hasLetters = /[a-zA-Z]/.test(newPassword);
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumbers = /[0-9]/.test(newPassword);
  const isNoConsecutive = newPassword.length > 0 && !/(.)\1{3,}/.test(newPassword);

  const isPasswordValid = isMinLength && hasLetters && hasUppercase && hasLowercase && hasNumbers && isNoConsecutive;

  // Sinh thông báo lỗi chi tiết màu đỏ giống hệt hình 1
  const getPasswordErrorMessage = () => {
    if (!newPassword) return '';
    
    const errors: string[] = [];
    if (!isMinLength) {
      errors.push(lang === 'vi' ? 'phải tối thiểu 8 ký tự' : 'must be at least 8 characters');
    }
    if (!hasLetters) {
      errors.push(lang === 'vi' ? 'phải chứa chữ cái (a-z, A-Z)' : 'must contain letters (a-z, A-Z)');
    } else {
      if (!hasUppercase) {
        errors.push(lang === 'vi' ? 'phải chứa ít nhất 1 chữ in hoa (A-Z)' : 'must contain at least one uppercase letter (A-Z)');
      }
      if (!hasLowercase) {
        errors.push(lang === 'vi' ? 'phải chứa ít nhất 1 chữ in thường (a-z)' : 'must contain at least one lowercase letter (a-z)');
      }
    }
    if (!hasNumbers) {
      errors.push(lang === 'vi' ? 'phải chứa ít nhất 1 chữ số (0-9)' : 'must contain at least one number (0-9)');
    }
    if (!isNoConsecutive) {
      errors.push(lang === 'vi' ? 'không được sử dụng 4 ký tự giống nhau liên tiếp' : 'must not contain 4 identical consecutive characters');
    }

    if (errors.length > 0) {
      return (lang === 'vi' ? 'Lỗi khi đổi mật khẩu: Mật khẩu ' : 'Error updating password: Password ') + errors.join(', ') + '.';
    }
    return '';
  };

  const passwordError = getPasswordErrorMessage();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleEmailSubmit = async () => {
    if (!email) {
      setErrorMsg(t.errorEmailRequired);
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await supabaseAuth.sendPasswordResetOtp(email);
      setStep('otp');
      setCountdown(300);
    } catch (error: any) {
      setErrorMsg(error.message || t.errorSendOtpFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setErrorMsg(t.errorOtpLength);
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const token = await supabaseAuth.verifyPasswordResetOtp(email, code);
      setAccessToken(token);
      setStep('reset');
    } catch (error: any) {
      setErrorMsg(error.message || t.errorVerifyFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (newPassword !== confirmPassword) {
      setErrorMsg(t.errorPasswordMismatch);
      return;
    }
    if (!isPasswordValid) {
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await supabaseAuth.updatePassword(accessToken, newPassword);
      setStep('success');
    } catch (error: any) {
      setErrorMsg(error.message || t.errorResetFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = () => {
    setLang(lang === 'vi' ? 'en' : 'vi');
    setErrorMsg('');
  };

  // Render từng dòng kiểm tra điều kiện mật khẩu
  const renderConstraintRow = (label: string, isValid: boolean) => {
    return (
      <View className="flex-row items-center space-x-2 mb-1.5">
        <Ionicons
          name={isValid ? "checkmark-circle" : "ellipse-outline"}
          size={16}
          color={isValid ? "#0052FF" : "#94A3B8"}
        />
        <Text className={`text-xs ml-1.5 ${isValid ? "text-brand-500 font-semibold" : "text-slate-400"}`}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-100" // Nền màu trắng xám chuẩn
    >
      {/* Nút dịch thuật ngôn ngữ ở góc trên cùng bên phải ngoài card */}
      <View 
        className="absolute z-50"
        style={{
          top: Platform.OS === 'ios' ? 50 : 20,
          right: 20,
        }}
      >
        <TouchableOpacity
          onPress={toggleLanguage}
          className="bg-white border border-slate-200 rounded-full px-3 py-1.5 flex-row items-center shadow-md"
        >
          <View className="mr-1"><Ionicons name="globe-outline" size={14} color="#64748B" /></View>
          <Text className="text-slate-600 font-bold text-xs ml-1">
            {lang === 'vi' ? 'VI 🇻🇳' : 'EN 🇬🇧'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ 
          flexGrow: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: 20, 
          paddingTop: Platform.OS === 'ios' ? 60 : 40 
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Khung Card chính chứa biểu mẫu, căn chỉnh chính giữa */}
        <View className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200/50 w-full max-w-md">
          {/* LOGO TOBOMEET DỰNG SẴN CĂN GIỮA (ĐÃ ĐƯỢC ĐƯA VÀO TRONG CARD VÀ BO GÓC) */}
          <View className="items-center mb-6 flex-row justify-center">
            {/* Biểu tượng Camera trắng trong khung xanh bo góc tròn tuyệt đẹp có độ nghiêng nghệ thuật và đổ bóng phát sáng */}
            <View 
              className="w-12 h-12 bg-[#0052FF] rounded-2xl items-center justify-center mr-4"
              style={{
                transform: [{ rotate: '3deg' }],
                shadowColor: '#0052FF',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 8,
              }}
            >
              <Ionicons name="videocam" size={26} color="white" />
            </View>
            {/* Chữ thương hiệu ToboMeet */}
            <Text className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Tobo<Text className="text-[#0052FF]">Meet</Text>
            </Text>
          </View>
          

          {/* BƯỚC 1: NHẬP EMAIL */}
          {step === 'email' && (
            <View>
              <View className="mb-6 items-center">
                <Text className="text-2xl font-bold text-slate-800 mb-2 uppercase tracking-wide">
                  {t.forgotPassword}
                </Text>
                <Text className="text-slate-500 text-sm leading-5 text-center px-2">
                  {t.forgotPasswordDesc}
                </Text>
              </View>

              <View className="space-y-4">
                <View>
                  <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t.email}</Text>
                  <View
                    className="w-full border rounded-xl px-4 py-3 flex-row items-center shadow-sm"
                    style={{
                      borderColor: focusedInput === 'email' ? '#0052FF' : errorMsg ? '#EF4444' : '#E2E8F0',
                      backgroundColor: focusedInput === 'email' ? '#FFFFFF' : '#F8FAFC',
                    }}
                  >
                    <View className="mr-2"><Ionicons name="mail-outline" size={20} color="#64748B" /></View>
                    <TextInput
                      className="flex-1 text-base text-slate-800 ml-2"
                      placeholder={t.emailPlaceholder}
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  {errorMsg ? (
                    <View className="flex-row items-center mt-2">
                      <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                      <Text className="text-red-500 text-xs ml-1.5 font-medium">{errorMsg}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={handleEmailSubmit}
                  disabled={isLoading || !email}
                  className={`w-full rounded-xl py-4 items-center justify-center mt-6 shadow-md ${
                    isLoading || !email ? 'opacity-70' : 'active:opacity-90'
                  }`}
                  style={{ backgroundColor: '#0052FF' }} // Nút màu xanh thương hiệu
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">{t.sendOtp}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()} className="mt-5 items-center">
                  <Text className="text-slate-500 font-bold text-sm">{t.backToLogin}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BƯỚC 2: NHẬP OTP */}
          {step === 'otp' && (
            <View>
              <View className="mb-6 items-center">
                <Text className="text-2xl font-bold text-slate-800 mb-2 uppercase tracking-wide">
                  {t.enterOtp}
                </Text>
                <Text className="text-slate-500 text-sm leading-5 text-center px-2">
                  {t.enterOtpDesc} <Text className="font-bold text-slate-700">{email}</Text>
                </Text>
              </View>

              <View className="space-y-6">
                <View className="flex-row justify-between">
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      className={`w-11 h-14 bg-slate-50 border rounded-xl text-center text-xl font-bold text-slate-800 ${
                        errorMsg ? 'border-red-500' : 'border-slate-200'
                      }`}
                      maxLength={1}
                      keyboardType="number-pad"
                      value={digit}
                      onChangeText={(text) => {
                        const newOtp = [...otp];
                        newOtp[index] = text;
                        setOtp(newOtp);
                      }}
                    />
                  ))}
                </View>

                {errorMsg ? (
                  <View className="flex-row items-center justify-center mt-2">
                    <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                    <Text className="text-red-500 text-xs ml-1.5 font-medium">{errorMsg}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleOtpSubmit}
                  disabled={isLoading || otp.join('').length < 6}
                  className={`w-full rounded-xl py-4 items-center justify-center mt-4 shadow-md ${
                    isLoading || otp.join('').length < 6 ? 'opacity-70' : ''
                  }`}
                  style={{ backgroundColor: '#0052FF' }} // Nút màu xanh thương hiệu
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">{t.verify}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BƯỚC 3: ĐẶT MẬT KHẨU MỚI */}
          {step === 'reset' && (
            <View>
              <View className="mb-6 items-center">
                <Text className="text-2xl font-bold text-slate-800 mb-2 uppercase tracking-wide">
                  {t.createNewPassword}
                </Text>
                <Text className="text-slate-500 text-sm leading-5 text-center">
                  {t.createNewPasswordDesc}
                </Text>
              </View>

              <View className="space-y-4">
                {/* Mật khẩu mới */}
                <View>
                  <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t.newPassword}</Text>
                  <View
                    className="w-full border rounded-xl px-4 py-3 flex-row items-center pr-12 shadow-sm"
                    style={{
                      borderColor: focusedInput === 'newPassword' ? '#0052FF' : '#E2E8F0',
                      backgroundColor: focusedInput === 'newPassword' ? '#FFFFFF' : '#F8FAFC',
                    }}
                  >
                    <View className="mr-2"><Ionicons name="lock-closed-outline" size={20} color="#64748B" /></View>
                    <TextInput
                      className="flex-1 text-base text-slate-800 ml-2"
                      placeholder={t.newPasswordPlaceholder}
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedInput('newPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      className="absolute right-4"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Xác nhận mật khẩu mới */}
                <View className="mt-3">
                  <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">{t.confirmPassword}</Text>
                  <View
                    className="w-full border rounded-xl px-4 py-3 flex-row items-center pr-12 shadow-sm"
                    style={{
                      borderColor: focusedInput === 'confirmPassword' ? '#0052FF' : '#E2E8F0',
                      backgroundColor: focusedInput === 'confirmPassword' ? '#FFFFFF' : '#F8FAFC',
                    }}
                  >
                    <View className="mr-2"><Ionicons name="lock-closed-outline" size={20} color="#64748B" /></View>
                    <TextInput
                      className="flex-1 text-base text-slate-800 ml-2"
                      placeholder={t.confirmPasswordPlaceholder}
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirm}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedInput('confirmPassword')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      className="absolute right-4"
                      onPress={() => setShowConfirm(!showConfirm)}
                    >
                      <Ionicons
                        name={showConfirm ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* THÔNG BÁO LỖI CHI TIẾT MÀU ĐỎ GIỐNG HÌNH 1 */}
                {passwordError ? (
                  <View className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                    <Text className="text-red-500 text-xs leading-5 font-medium">
                      {passwordError}
                    </Text>
                  </View>
                ) : null}

                {errorMsg ? (
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                    <Text className="text-red-500 text-xs ml-1.5 font-medium">{errorMsg}</Text>
                  </View>
                ) : null}

                {/* KHU VỰC RÀNG BUỘC MẬT KHẨU (VALIDATOR) */}
                <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-4">
                  <Text className="text-slate-800 font-bold text-sm mb-3">{t.reqTitle}</Text>
                  {renderConstraintRow(t.reqMinLength, isMinLength)}
                  {renderConstraintRow(t.reqLetters, hasLetters)}
                  {renderConstraintRow(t.reqUppercase, hasUppercase)}
                  {renderConstraintRow(t.reqLowercase, hasLowercase)}
                  {renderConstraintRow(t.reqNumbers, hasNumbers)}

                  <View className="h-px bg-slate-200 my-3" />

                  <Text className="text-slate-800 font-bold text-sm mb-2">{t.ruleTitle}</Text>
                  {renderConstraintRow(t.ruleConsecutive, isNoConsecutive)}
                </View>

                <TouchableOpacity
                  onPress={handleResetSubmit}
                  disabled={isLoading || !isPasswordValid || newPassword !== confirmPassword}
                  className={`w-full rounded-xl py-4 items-center justify-center mt-6 shadow-md ${
                    isLoading || !isPasswordValid || newPassword !== confirmPassword ? 'opacity-50' : 'active:opacity-90'
                  }`}
                  style={{ backgroundColor: '#0052FF' }} // Nút màu xanh thương hiệu
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">{t.updatePassword}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BƯỚC 4: THÀNH CÔNG */}
          {step === 'success' && (
            <View className="items-center py-6">
              <View className="w-20 h-20 bg-green-50 rounded-full items-center justify-center mb-6 border border-green-100">
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
              <Text className="text-2xl font-bold text-slate-900 mb-3 text-center">{t.success}</Text>
              <Text className="text-slate-500 text-sm text-center mb-8 leading-6">
                {t.successDesc}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login')}
                className="w-full rounded-xl py-4 items-center justify-center shadow-md"
                style={{ backgroundColor: '#0052FF' }} // Nút màu xanh thương hiệu
              >
                <Text className="text-white font-bold text-base">{t.backToLogin}</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
