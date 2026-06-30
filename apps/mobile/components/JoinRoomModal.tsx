import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useJoinRoomMutation } from "../lib/redux/features/rooms/roomsApi";
import { Feather } from "@expo/vector-icons";

interface JoinRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (roomId: string) => void;
}

export default function JoinRoomModal({
  visible,
  onClose,
  onSuccess,
}: JoinRoomModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [joinRoom, { isLoading }] = useJoinRoomMutation();
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setError(null);

    try {
      const room = await joinRoom({ code: code.trim() }).unwrap();
      setCode("");
      onSuccess(room._id);
    } catch (err: any) {
      setError(err?.message || t("dashboard.room_not_found_code"));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/40 px-4">
        {/* Backdrop Tap to Close */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="absolute inset-0"
        />

        {/* Dialog */}
        <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl border border-slate-100">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-blue-50 justify-center items-center">
                <Feather name="user-plus" size={18} color="#0052FF" />
              </View>
              <Text className="text-lg font-bold text-slate-900">
                {t("dashboard.join_team")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
            >
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View className="mb-5">
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={t("dashboard.room_code_placeholder")}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900"
            />

            {error && (
              <View className="flex-row items-center gap-2 mt-3">
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text className="text-red-600 text-xs flex-1">{error}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View className="flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="px-4 py-3 rounded-xl bg-slate-100 justify-center items-center"
            >
              <Text className="text-sm font-medium text-slate-600">
                {t("dashboard.cancel")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleJoin}
              disabled={!code.trim() || isLoading}
              className={`px-5 py-3 rounded-xl justify-center items-center flex-row gap-2 ${
                !code.trim() || isLoading ? "bg-blue-300" : "bg-[#0052FF]"
              }`}
            >
              {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
              <Text className="text-white font-bold text-sm">
                {t("dashboard.join")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
