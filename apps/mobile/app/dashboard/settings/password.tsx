import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useChangePasswordMutation } from "../../../lib/redux/features/users/usersApi";
import { toast } from "../../../lib/toast";

interface PasswordInputProps {
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  visible: boolean;
  disabled?: boolean;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  onToggleVisible: () => void;
}

function PasswordInput({
  label,
  placeholder,
  value,
  error,
  visible,
  disabled,
  onChangeText,
  onBlur,
  onToggleVisible,
}: PasswordInputProps) {
  return (
    <View className="gap-1.5 mb-4">
      <Text className="text-xs font-bold text-slate-600 pl-1">{label}</Text>
      <View
        className={`flex-row items-center border rounded-2xl bg-white px-4 py-3.5 ${
          error ? "border-red-500/80 bg-red-50/5" : "border-slate-200"
        }`}
      >
        <TextInput
          secureTextEntry={!visible}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          onChangeText={onChangeText}
          onBlur={onBlur}
          editable={!disabled}
          className="flex-1 text-slate-800 text-sm p-0 m-0"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ paddingVertical: 0 }}
        />
        <TouchableOpacity onPress={onToggleVisible} className="p-1 -mr-1">
          <Feather name={visible ? "eye-off" : "eye"} size={16} color="#64748B" />
        </TouchableOpacity>
      </View>
      {error ? <Text className="text-[11px] text-red-500 font-semibold pl-1 mt-0.5">{error}</Text> : null}
    </View>
  );
}

const PASSWORD_RULES = {
  minLength: (v: string) => v.length >= 8,
  hasLowercase: (v: string) => /[a-z]/.test(v),
  hasUppercase: (v: string) => /[A-Z]/.test(v),
  hasDigit: (v: string) => /[0-9]/.test(v),
  hasSpecial: (v: string) =>
    /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(v),
};

function PasswordStrengthHints({ password, t }: { password: string; t: any }) {
  if (!password) return null;

  const rules = [
    { key: "hint_min", pass: PASSWORD_RULES.minLength(password) },
    { key: "hint_uppercase", pass: PASSWORD_RULES.hasUppercase(password) },
    { key: "hint_lowercase", pass: PASSWORD_RULES.hasLowercase(password) },
    { key: "hint_digit", pass: PASSWORD_RULES.hasDigit(password) },
    { key: "hint_special", pass: PASSWORD_RULES.hasSpecial(password) },
  ] as const;

  const allPass = rules.every((r) => r.pass);
  if (allPass) return null;

  return (
    <View className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4 gap-2">
      <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-0.5">
        {t("settings.password.hint_title")}
      </Text>
      {rules.map((rule) => (
        <View key={rule.key} className="flex-row items-center gap-2">
          {rule.pass ? (
            <Feather name="check-circle" size={14} color="#10B981" />
          ) : (
            <Feather name="circle" size={14} color="#CBD5E1" />
          )}
          <Text
            className={`text-xs ${rule.pass ? "text-emerald-600 font-medium" : "text-slate-500"}`}
          >
            {t(`settings.password.${rule.key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { t } = useTranslation();

  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
    api?: string;
  }>({});

  const [touched, setTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [visible, setVisible] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const validateField = useCallback(
    (field: keyof typeof values, vals: typeof values): string | undefined => {
      switch (field) {
        case "currentPassword":
          if (!vals.currentPassword.trim()) return t("settings.password.error_current_required");
          return undefined;

        case "newPassword": {
          const p = vals.newPassword;
          if (!p.trim()) return t("settings.password.error_new_required");
          if (!PASSWORD_RULES.minLength(p)) return t("settings.password.error_new_min");
          if (!PASSWORD_RULES.hasUppercase(p)) return t("settings.password.error_new_uppercase");
          if (!PASSWORD_RULES.hasLowercase(p)) return t("settings.password.error_new_lowercase");
          if (!PASSWORD_RULES.hasDigit(p)) return t("settings.password.error_new_digit");
          if (!PASSWORD_RULES.hasSpecial(p)) return t("settings.password.error_new_special");
          if (vals.currentPassword.trim() && p === vals.currentPassword)
            return t("settings.password.error_new_same");
          return undefined;
        }

        case "confirmPassword":
          if (!vals.confirmPassword.trim()) return t("settings.password.error_confirm_required");
          if (vals.confirmPassword !== vals.newPassword)
            return t("settings.password.error_confirm_mismatch");
          return undefined;

        default:
          return undefined;
      }
    },
    [t]
  );

  const validateAll = useCallback(
    (vals: typeof values) => ({
      currentPassword: validateField("currentPassword", vals),
      newPassword: validateField("newPassword", vals),
      confirmPassword: validateField("confirmPassword", vals),
    }),
    [validateField]
  );

  const isFormValid = useCallback(
    (vals: typeof values, errs: typeof errors): boolean => {
      if (!vals.currentPassword.trim()) return false;
      const p = vals.newPassword;
      if (!p.trim()) return false;
      if (!PASSWORD_RULES.minLength(p)) return false;
      if (!PASSWORD_RULES.hasUppercase(p)) return false;
      if (!PASSWORD_RULES.hasLowercase(p)) return false;
      if (!PASSWORD_RULES.hasDigit(p)) return false;
      if (!PASSWORD_RULES.hasSpecial(p)) return false;
      if (p === vals.currentPassword) return false;
      if (vals.confirmPassword !== vals.newPassword) return false;
      return !errs.currentPassword && !errs.newPassword && !errs.confirmPassword;
    },
    []
  );

  const handleChange = (field: keyof typeof values, text: string) => {
    const nextValues = { ...values, [field]: text };
    setValues(nextValues);

    if (touched[field]) {
      const nextErrors = {
        ...errors,
        [field]: validateField(field, nextValues),
        api: undefined,
      };
      if (field === "newPassword" && touched.confirmPassword) {
        nextErrors.confirmPassword = validateField("confirmPassword", nextValues);
      }
      setErrors(nextErrors);
    }
  };

  const handleBlur = (field: keyof typeof values) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({
      ...prev,
      [field]: validateField(field, values),
      api: undefined,
    }));
  };

  const handleCancel = () => {
    setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setErrors({});
    setTouched({ currentPassword: false, newPassword: false, confirmPassword: false });
  };

  const handleSubmit = async () => {
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });
    const allErrors = validateAll(values);
    setErrors(allErrors);

    if (allErrors.currentPassword || allErrors.newPassword || allErrors.confirmPassword) return;

    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();

      toast.success(t("settings.password.success"));
      handleCancel();
      router.back();
    } catch (err: any) {
      const apiErr = err as { code?: number; message?: string; data?: { code?: number; message?: string } };
      const code = apiErr?.data?.code || apiErr?.code;
      const message = (apiErr?.data?.message || apiErr?.message || "").toLowerCase();

      const isWrongCurrent =
        code === 400 ||
        code === 401 ||
        message.includes("current") ||
        message.includes("incorrect") ||
        message.includes("invalid") ||
        message.includes("wrong") ||
        message.includes("khong chinh xac") ||
        message.includes("sai mat khau");

      if (isWrongCurrent) {
        setErrors((prev) => ({
          ...prev,
          currentPassword: t("settings.password.error_wrong_current"),
        }));
        return;
      }
      if (code === 5000 || code === 503 || message.includes("connect")) {
        setErrors((prev) => ({ ...prev, api: t("settings.password.error_network") }));
        return;
      }
      setErrors((prev) => ({ ...prev, api: t("settings.password.error_generic") }));
    }
  };

  const formValid = isFormValid(values, errors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50"
    >
      {/* Header */}
      <View className="px-6 py-4 bg-white border-b border-slate-100 flex-row items-center gap-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-1 -ml-1 rounded-full active:bg-slate-100"
        >
          <Feather name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900">
          {t("settings.password.header")}
        </Text>
      </View>

      <ScrollView className="flex-1 p-6" keyboardShouldPersistTaps="handled">
        {/* API error */}
        {errors.api && (
          <View className="px-4 py-3.5 mb-4 rounded-2xl border border-red-200 bg-red-50 text-[13px] text-red-600 font-semibold">
            <Text className="text-red-600 text-xs font-semibold">{errors.api}</Text>
          </View>
        )}

        <PasswordInput
          label={t("settings.password.current_label")}
          placeholder={t("settings.password.current_placeholder")}
          value={values.currentPassword}
          error={touched.currentPassword ? errors.currentPassword : undefined}
          visible={visible.currentPassword}
          disabled={isLoading}
          onChangeText={(text) => handleChange("currentPassword", text)}
          onBlur={() => handleBlur("currentPassword")}
          onToggleVisible={() =>
            setVisible((prev) => ({ ...prev, currentPassword: !prev.currentPassword }))
          }
        />

        <PasswordInput
          label={t("settings.password.new_label")}
          placeholder={t("settings.password.new_placeholder")}
          value={values.newPassword}
          error={touched.newPassword ? errors.newPassword : undefined}
          visible={visible.newPassword}
          disabled={isLoading}
          onChangeText={(text) => handleChange("newPassword", text)}
          onBlur={() => handleBlur("newPassword")}
          onToggleVisible={() =>
            setVisible((prev) => ({ ...prev, newPassword: !prev.newPassword }))
          }
        />

        {/* Requirements indicator list */}
        <PasswordStrengthHints password={values.newPassword} t={t} />

        <PasswordInput
          label={t("settings.password.confirm_label")}
          placeholder={t("settings.password.confirm_placeholder")}
          value={values.confirmPassword}
          error={touched.confirmPassword ? errors.confirmPassword : undefined}
          visible={visible.confirmPassword}
          disabled={isLoading}
          onChangeText={(text) => handleChange("confirmPassword", text)}
          onBlur={() => handleBlur("confirmPassword")}
          onToggleVisible={() =>
            setVisible((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))
          }
        />
      </ScrollView>

      {/* Action Buttons at the Bottom */}
      <View className="p-6 border-t border-slate-100 bg-white gap-3 flex-row">
        <TouchableOpacity
          onPress={handleCancel}
          disabled={isLoading}
          className="flex-1 py-4 rounded-2xl items-center justify-center bg-slate-100 border border-slate-200 active:opacity-70"
        >
          <Text className="text-slate-600 font-bold text-sm">
            {t("settings.password.cancel")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!formValid || isLoading}
          className={`flex-1 py-4 rounded-2xl items-center justify-center flex-row gap-2 active:opacity-70 ${
            formValid && !isLoading ? "bg-[#0052FF]" : "bg-blue-500/50"
          }`}
        >
          {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
          <Text className="text-white font-bold text-sm">
            {isLoading ? t("settings.password.submitting") : t("settings.password.submit")}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
