import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

interface CreateTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAssignment: () => void;
  onSelectQuiz: () => void;
}

export default function CreateTaskModal({
  visible,
  onClose,
  onSelectAssignment,
  onSelectQuiz,
}: CreateTaskModalProps) {
  const { t } = useTranslation();

  const handleSelectAssignment = () => {
    onClose();
    onSelectAssignment();
  };

  const handleSelectQuiz = () => {
    onClose();
    onSelectQuiz();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-t-3xl p-5 pb-8 shadow-2xl">
              {/* Handle bar */}
              <View className="items-center mb-4">
                <View className="w-12 h-1.5 bg-slate-300 rounded-full" />
              </View>

              {/* Title & Close */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-bold text-slate-900">
                  {t("assignments.create_btn")}
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Options */}
              <View className="gap-3">
                {/* Option 1: Tạo nhiệm vụ được giao */}
                <TouchableOpacity
                  onPress={handleSelectAssignment}
                  activeOpacity={0.7}
                  className="flex-row items-center p-3.5 bg-slate-50 active:bg-blue-50/60 border border-slate-200 active:border-blue-200 rounded-2xl"
                >
                  <View className="w-11 h-11 rounded-xl bg-blue-100 items-center justify-center mr-3.5">
                    <Feather name="file-text" size={22} color="#0052FF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 mb-0.5">
                      {t("assignments.type_assignment")}
                    </Text>
                    <Text className="text-xs text-slate-500 leading-4">
                      {t("assignments.type_assignment_desc")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* Option 2: Trắc nghiệm */}
                <TouchableOpacity
                  onPress={handleSelectQuiz}
                  activeOpacity={0.7}
                  className="flex-row items-center p-3.5 bg-slate-50 active:bg-purple-50/60 border border-slate-200 active:border-purple-200 rounded-2xl"
                >
                  <View className="w-11 h-11 rounded-xl bg-purple-100 items-center justify-center mr-3.5">
                    <Feather name="check-square" size={22} color="#9333EA" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 mb-0.5">
                      {t("assignments.type_quiz")}
                    </Text>
                    <Text className="text-xs text-slate-500 leading-4">
                      {t("assignments.type_quiz_desc")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
