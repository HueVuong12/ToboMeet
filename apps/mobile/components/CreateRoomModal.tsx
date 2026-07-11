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
import { useCreateRoomMutation } from "../lib/redux/features/rooms/roomsApi";
import { Feather } from "@expo/vector-icons";

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (roomId: string) => void;
}

type Step = "select-type" | "enter-name";

export default function CreateRoomModal({
  visible,
  onClose,
  onSuccess,
}: CreateRoomModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("select-type");
  const [selectedType, setSelectedType] = useState<"meeting" | "classroom" | null>(null);
  const [roomName, setRoomName] = useState("");
  const [createRoom, { isLoading }] = useCreateRoomMutation();
  const [error, setError] = useState<string | null>(null);

  const handleSelectType = (type: "meeting" | "classroom") => {
    setSelectedType(type);
    setStep("enter-name");
  };

  const handleBack = () => {
    setStep("select-type");
    setSelectedType(null);
    setRoomName("");
    setError(null);
  };

  const handleCreate = async () => {
    if (!roomName.trim() || !selectedType) return;
    setError(null);

    try {
      const room = await createRoom({
        name: roomName.trim(),
        type: selectedType,
      }).unwrap();
      setStep("select-type");
      setSelectedType(null);
      setRoomName("");
      onSuccess(room._id);
    } catch (err) {
      const errorResponse = err as { message?: string; data?: { message?: string } };
      setError(errorResponse.data?.message || errorResponse.message || t("dashboard.create_room_failed"));
    }
  };

  const handleClose = () => {
    setStep("select-type");
    setSelectedType(null);
    setRoomName("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-center items-center bg-black/40 px-4">
        <TouchableOpacity activeOpacity={1} onPress={handleClose} className="absolute inset-0" />

        <View className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl border border-slate-100">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center gap-3">
              {step === "enter-name" && (
                <TouchableOpacity onPress={handleBack} className="mr-1">
                  <Feather name="arrow-left" size={20} color="#64748B" />
                </TouchableOpacity>
              )}
              <Text className="text-lg font-bold text-slate-900">
                {t("dashboard.create_team")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              className="w-8 h-8 rounded-lg bg-slate-100 justify-center items-center"
            >
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Step 1: Select Type */}
          {step === "select-type" && (
            <View className="gap-3 mb-2">
              <Text className="text-xs text-slate-400 font-semibold mb-1 uppercase">
                {t("dashboard.select_room_type")}
              </Text>

              {/* Meeting Option */}
              <TouchableOpacity
                onPress={() => handleSelectType("meeting")}
                className="flex-row items-center p-4 rounded-2xl border border-slate-100 bg-slate-50/50 active:bg-slate-100"
              >
                <View className="w-12 h-12 rounded-xl bg-blue-50 justify-center items-center mr-4">
                  <Feather name="video" size={22} color="#0052FF" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-800 text-sm">
                    {t("dashboard.meeting")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </TouchableOpacity>

              {/* Classroom Option */}
              <TouchableOpacity
                onPress={() => handleSelectType("classroom")}
                className="flex-row items-center p-4 rounded-2xl border border-slate-100 bg-slate-50/50 active:bg-slate-100"
              >
                <View className="w-12 h-12 rounded-xl bg-indigo-50 justify-center items-center mr-4">
                  <Feather name="book-open" size={22} color="#4F46E5" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-slate-800 text-sm">
                    {t("dashboard.classroom")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Enter Name */}
          {step === "enter-name" && (
            <View className="mb-5">
              <Text className="text-xs text-slate-400 font-semibold mb-2 uppercase">
                {t("dashboard.room_name_placeholder")}
              </Text>
              <TextInput
                value={roomName}
                onChangeText={setRoomName}
                placeholder={t("dashboard.room_name_placeholder")}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 mb-3"
              />

              {error && (
                <View className="flex-row items-center gap-2 mb-3">
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text className="text-red-600 text-xs flex-1">{error}</Text>
                </View>
              )}

              <View className="flex-row justify-end gap-3 mt-2">
                <TouchableOpacity
                  onPress={handleBack}
                  className="px-4 py-3 rounded-xl bg-slate-100 justify-center items-center"
                >
                  <Text className="text-sm font-medium text-slate-600">
                    {t("dashboard.step_back")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={!roomName.trim() || isLoading}
                  className={`px-5 py-3 rounded-xl justify-center items-center flex-row gap-2 ${
                    !roomName.trim() || isLoading ? "bg-blue-300" : "bg-[#0052FF]"
                  }`}
                >
                  {isLoading && <ActivityIndicator size="small" color="#ffffff" />}
                  <Text className="text-white font-bold text-sm">
                    {t("dashboard.create_room")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
