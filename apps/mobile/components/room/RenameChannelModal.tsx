import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useRenameChannelMutation } from "../../lib/redux/features/rooms/roomsApi";
import { toast } from "../../lib/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RenameChannelModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  channel: {
    _id: string;
    name: string;
    isPrivate?: boolean;
  } | null;
}

export default function RenameChannelModal({
  visible,
  onClose,
  roomId,
  channel,
}: RenameChannelModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [renameChannel, { isLoading }] = useRenameChannelMutation();

  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && channel) {
      setNewName(channel.name);
      setError(null);
    }
  }, [visible, channel]);

  if (!visible || !channel) return null;

  const handleSubmit = async () => {
    setError(null);

    const trimmedNewName = newName.trim();

    if (!trimmedNewName) {
      setError("Tên kênh không được để trống");
      return;
    }

    if (trimmedNewName.length > 30) {
      setError("Tên kênh không được vượt quá 30 ký tự");
      return;
    }

    // Nếu không thay đổi tên thì đóng modal
    if (trimmedNewName === channel.name) {
      onClose();
      return;
    }

    try {
      await renameChannel({
        roomId,
        channelId: channel._id,
        name: trimmedNewName,
      }).unwrap();

      toast.success("Đổi tên kênh thành công.");
      onClose();
    } catch (err) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      const rawMsg = errorObj?.data?.message || errorObj?.message;
      setError(rawMsg || "Đổi tên kênh thất bại");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!isLoading) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className="flex-1 justify-center items-center bg-black/45 px-4"
          style={{
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (!isLoading) onClose();
            }}
            className="absolute inset-0"
          />

          <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl flex-col">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <Text className="text-lg font-bold text-slate-900">
                Đổi tên kênh
              </Text>
              <TouchableOpacity
                disabled={isLoading}
                onPress={onClose}
                className="p-1.5 rounded-xl bg-slate-100"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current Channel Name */}
            <View className="mb-4">
              <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tên kênh hiện tại
              </Text>
              <View className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <Text className="text-base font-semibold text-slate-500">
                  {channel.name}
                </Text>
              </View>
            </View>

            {/* New Channel Name */}
            <View className="mb-5">
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Tên kênh mới *
              </Text>
              <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nhập tên kênh mới..."
                  placeholderTextColor="#94A3B8"
                  maxLength={30}
                  className="flex-1 text-base text-slate-800 py-0.5"
                  autoFocus
                />
              </View>
            </View>

            {error && (
              <View className="bg-red-50 border border-red-100 rounded-xl p-3 flex-row items-center gap-2 mb-4">
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text className="text-red-600 text-xs flex-1">{error}</Text>
              </View>
            )}

            {/* Footer buttons */}
            <View className="flex-row gap-3 mt-4 border-t border-slate-100 pt-4 w-full">
              <TouchableOpacity
                disabled={isLoading}
                onPress={onClose}
                className="flex-1 py-3.5 bg-[#F1F5F9] rounded-xl justify-center items-center active:bg-slate-200"
              >
                <Text className="text-sm font-bold text-slate-700">
                  Hủy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!newName.trim() || isLoading}
                className={`flex-1 py-3.5 rounded-xl justify-center items-center flex-row gap-2 active:opacity-95 ${
                  !newName.trim() || isLoading ? "bg-blue-300" : "bg-[#0052FF]"
                }`}
              >
                {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
                <Text className="text-white font-bold text-sm">
                  Lưu
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
