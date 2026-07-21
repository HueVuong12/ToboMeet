import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useGetPostReactionsQuery,
  PostReactionUserDto,
} from "../../lib/redux/features/newsFeed/newsFeedApi";
import { REACTION_ICONS } from "./ReactionPicker";

interface PostReactionsModalProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

export default function PostReactionsModal({
  visible,
  postId,
  onClose,
}: PostReactionsModalProps) {
  const { t } = useTranslation();
  const { data: reactions = [], isLoading } = useGetPostReactionsQuery(postId, {
    skip: !postId || !visible,
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          className="absolute inset-0"
        />

        <View className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl z-10 border border-slate-100 max-h-[70vh]">
          {/* Header */}
          <View className="px-6 py-4 border-b border-slate-100 flex-row justify-between items-center bg-white">
            <Text className="font-bold text-slate-900 text-base">
              {t("news_feed.reactions_title", { count: reactions.length })}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1 rounded-full">
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* List */}
          {isLoading ? (
            <View className="p-10 justify-center items-center">
              <ActivityIndicator size="small" color="#0052FF" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {reactions.length === 0 ? (
                <Text className="text-center text-slate-400 text-sm py-6">
                  {t("news_feed.no_reactions")}
                </Text>
              ) : (
                reactions.map((item: PostReactionUserDto, idx: number) => {
                  const reactionInfo = REACTION_ICONS[item.reaction];
                  return (
                    <View
                      key={idx}
                      className="flex-row items-center justify-between py-2.5 border-b border-slate-50 last:border-0"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-blue-50 justify-center items-center">
                          <Text className="font-bold text-blue-600 text-sm">
                            {item.user?.displayName
                              ? item.user.displayName.charAt(0).toUpperCase()
                              : "U"}
                          </Text>
                        </View>
                        <View>
                          <Text className="font-bold text-slate-800 text-sm">
                            {item.user?.displayName || "User"}
                          </Text>
                          {item.user?.role === "owner" && (
                            <Text className="text-[10px] text-amber-600 font-semibold mt-0.5">
                              {t("news_feed.owner")}
                            </Text>
                          )}
                        </View>
                      </View>

                      <Text className="text-2xl">
                        {reactionInfo ? reactionInfo.emoji : "👍"}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
