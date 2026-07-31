import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";

export const REACTION_ICONS: Record<string, { emoji: string; label: string }> = {
  "👍": { emoji: "👍", label: "Thích" },
  "❤️": { emoji: "❤️", label: "Yêu thích" },
  "😆": { emoji: "😆", label: "Haha" },
  "😮": { emoji: "😮", label: "Wow" },
  "😢": { emoji: "😢", label: "Buồn" },
  "😡": { emoji: "😡", label: "Phẫn nộ" },
};

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectReaction: (type: string) => void;
}

export default function ReactionPicker({
  visible,
  onClose,
  onSelectReaction,
}: ReactionPickerProps) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/20 justify-center items-center px-4"
      >
        <View className="bg-white rounded-full px-4 py-3 flex-row items-center gap-3 shadow-2xl border border-slate-100">
          {Object.entries(REACTION_ICONS).map(([type, { emoji }]) => (
            <TouchableOpacity
              key={type}
              onPress={() => {
                onSelectReaction(type);
                onClose();
              }}
              className="p-1 active:scale-125"
            >
              <Text className="text-2xl">{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
