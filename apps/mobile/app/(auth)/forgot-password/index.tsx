import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../lib/api';

type FormStep = 'email' | 'otp' | 'reset' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
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

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleEmailSubmit = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await api.post('/auth/forgot-password', { email });
      setStep('otp');
      setCountdown(300);
    } catch (error: any) {
      setErrorMsg(error.message || 'Lỗi khi gửi email xác minh');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const code = otp.join('');
      await api.post('/auth/verify-otp', { email, code });
      setStep('reset');
    } catch (error: any) {
      setErrorMsg(error.message || 'Mã xác minh không hợp lệ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (newPassword !== confirmPassword) {
      setErrorMsg('Mật khẩu không khớp');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const code = otp.join('');
      await api.post('/auth/reset-password', { email, code, password: newPassword });
      setStep('success');
    } catch (error: any) {
      setErrorMsg(error.message || 'Lỗi khi cập nhật mật khẩu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      {step === 'email' && (
        <View>
          <View className="mb-8">
            <Text className="text-3xl font-bold text-navy mb-2">Quên mật khẩu?</Text>
            <Text className="text-slate-500 text-base">
              Vui lòng nhập địa chỉ email của bạn để nhận mã xác minh đặt lại mật khẩu.
            </Text>
          </View>
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-slate-700 mb-1">Email</Text>
              <TextInput
                className={`w-full bg-slate-50 border ${errorMsg ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-3 text-base text-navy`}
                placeholder="Nhập email của bạn"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errorMsg ? <Text className="text-red-500 text-sm mt-1">{errorMsg}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={handleEmailSubmit}
              disabled={isLoading || !email}
              className={`w-full bg-brand-500 rounded-xl py-4 items-center justify-center mt-4 ${isLoading || !email ? 'opacity-70' : ''}`}
            >
              {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Gửi mã xác minh</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} className="mt-4 items-center">
              <Text className="text-slate-500 font-semibold">Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'otp' && (
        <View>
          <View className="mb-8">
            <Text className="text-3xl font-bold text-navy mb-2">Nhập mã xác minh</Text>
            <Text className="text-slate-500 text-base">
              Mã xác minh gồm 6 chữ số đã được gửi đến <Text className="font-bold">{email}</Text>
            </Text>
          </View>
          <View className="space-y-6">
            <View className="flex-row justify-between">
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  className={`w-12 h-14 bg-slate-50 border ${errorMsg ? 'border-red-500' : 'border-slate-200'} rounded-xl text-center text-xl font-bold text-navy`}
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
            {errorMsg ? <Text className="text-red-500 text-sm text-center">{errorMsg}</Text> : null}
            <TouchableOpacity
              onPress={handleOtpSubmit}
              disabled={isLoading || otp.join('').length < 6}
              className={`w-full bg-brand-500 rounded-xl py-4 items-center justify-center mt-4 ${isLoading || otp.join('').length < 6 ? 'opacity-70' : ''}`}
            >
              {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Xác nhận</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'reset' && (
        <View>
          <View className="mb-8">
            <Text className="text-3xl font-bold text-navy mb-2">Đặt mật khẩu mới</Text>
          </View>
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-semibold text-slate-700 mb-1">Mật khẩu mới</Text>
              <View className="relative justify-center">
                <TextInput
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base text-navy pr-12"
                  placeholder="Nhập mật khẩu mới"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity className="absolute right-4" onPress={() => setShowPassword(!showPassword)}>
                  <Text className="text-slate-400 font-bold">{showPassword ? 'Ẩn' : 'Hiện'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View>
              <Text className="text-sm font-semibold text-slate-700 mb-1">Xác nhận mật khẩu</Text>
              <View className="relative justify-center">
                <TextInput
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base text-navy pr-12"
                  placeholder="Nhập lại mật khẩu mới"
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity className="absolute right-4" onPress={() => setShowConfirm(!showConfirm)}>
                  <Text className="text-slate-400 font-bold">{showConfirm ? 'Ẩn' : 'Hiện'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {errorMsg ? <Text className="text-red-500 text-sm">{errorMsg}</Text> : null}
            <TouchableOpacity
              onPress={handleResetSubmit}
              disabled={isLoading || !newPassword || !confirmPassword}
              className={`w-full bg-brand-500 rounded-xl py-4 items-center justify-center mt-6 ${isLoading || !newPassword ? 'opacity-70' : ''}`}
            >
              {isLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Cập nhật mật khẩu</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'success' && (
        <View className="items-center mt-10">
          <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-8">
            <Text className="text-5xl">✓</Text>
          </View>
          <Text className="text-3xl font-bold text-navy mb-4 text-center">Thành công!</Text>
          <Text className="text-slate-500 text-base text-center mb-12">
            Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            className="w-full bg-brand-500 rounded-xl py-4 items-center justify-center"
          >
            <Text className="text-white font-bold text-base">Quay lại đăng nhập</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
