import React, { useState, useMemo, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
  Linking,
  Keyboard,
  type KeyboardEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatManager } from "../../hooks/useChatManager";
import { useRoomSettings } from "../../hooks/useRoomSettings";
import { useTranslation } from "react-i18next";

/** Nhóm tin liên tiếp cùng người gửi */
function groupMessages<
  T extends { id: string; senderIdentity: string; senderName?: string },
>(messages: T[]) {
  const groups: {
    senderIdentity: string;
    senderName?: string;
    messages: T[];
  }[] = [];

  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.senderIdentity === msg.senderIdentity) {
      last.messages.push(msg);
    } else {
      groups.push({
        senderIdentity: msg.senderIdentity,
        senderName: msg.senderName,
        messages: [msg],
      });
    }
  }
  return groups;
}

export default function MobileChatModal({
  visible,
  onClose,
  roomId,
  channelId,
  meetingCode,
}: {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  channelId: string;
  meetingCode: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { canChat } = useRoomSettings({ roomId, channelId, meetingCode });

  const {
    localParticipant,
    otherParticipants,
    messages,
    inputValue,
    setInputValue,
    isProcessing,
    replyingTo,
    setReplyingTo,
    reactionDetails,
    setReactionDetails,
    activeMessage,
    setActiveMessage,
    previewMedia,
    setPreviewMedia,
    selectedTarget,
    setSelectedTarget,
    QUICK_EMOJIS,
    handleSendText,
    handleReact,
    handlePickImage,
    handlePickDocument,
    getParticipantDetails,
  } = useChatManager({ meetingCode });

  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Theo dõi bàn phím — tránh padding "dính" của KeyboardAvoidingView
  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [visible]);

  // Khi đóng modal → reset keyboard height
  useEffect(() => {
    if (!visible) setKeyboardHeight(0);
  }, [visible]);

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  // Root layout đã có SafeAreaView top+bottom.
  // Chỉ cộng insets.bottom khi bàn phím ĐÓNG; khi mở thì dùng keyboardHeight.
  const bottomPad =
    keyboardHeight > 0 ? keyboardHeight : Math.max(insets.bottom, 8);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
      />

      <View className="flex-1 mt-20 justify-end">
        <View
          className="flex-1 rounded-t-3xl overflow-hidden border-t border-white/10"
          style={{
            position: "absolute",
            top: 50,
            left: 0,
            right: 0,
            bottom: keyboardHeight, // bàn phím mở → đáy panel nhích lên
            backgroundColor: "#0a0a0a",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: "hidden",
          }}
        >
          {/* HEADER */}
          <View className="flex-row justify-between items-center px-4 py-3.5 border-b border-white/10 shrink-0">
            <Text className="text-white font-semibold text-base">
              {t("meeting.chat.chat_header")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-white/10"
            >
              <Feather name="x" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* DANH SÁCH TIN (đã group) */}
          <FlatList
            style={{ flex: 1 }}
            data={messageGroups}
            keyExtractor={(group) => group.messages[0].id}
            contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            renderItem={({ item: group }) => {
              const isMe = group.senderIdentity === localParticipant?.identity;
              const { displayName: realtimeSenderName } = getParticipantDetails(
                group.senderIdentity,
                group.senderName,
              );

              return (
                <View
                  className={`mb-3 max-w-[88%] ${isMe ? "self-end" : "self-start"}`}
                >
                  {/* Tên chỉ hiện 1 lần đầu nhóm */}
                  <View
                    className={`flex-row items-center mb-1 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <Text className="text-[11px] text-slate-500 font-medium">
                      {realtimeSenderName}
                    </Text>
                  </View>

                  <View
                    className={`gap-0.5 ${isMe ? "items-end" : "items-start"}`}
                  >
                    {group.messages.map((item, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === group.messages.length - 1;

                      let realtimeReplySenderName = item.replyToSender;
                      if (item.replyToMsgId) {
                        const originalMsg = messages.find(
                          (m) => m.id === item.replyToMsgId,
                        );
                        if (originalMsg) {
                          realtimeReplySenderName = getParticipantDetails(
                            originalMsg.senderIdentity,
                            item.replyToSender,
                          ).displayName;
                        }
                      }

                      return (
                        <View
                          key={item.id}
                          className={isMe ? "items-end" : "items-start"}
                        >
                          <TouchableOpacity
                            activeOpacity={0.85}
                            delayLongPress={250}
                            onLongPress={() => setActiveMessage(item)}
                            onPress={() => {
                              if (item.publicUrl) {
                                if (item.fileType?.startsWith("image/")) {
                                  setPreviewMedia({
                                    url: item.publicUrl,
                                    name: item.fileName || "image",
                                  });
                                } else {
                                  Linking.openURL(item.publicUrl);
                                }
                              }
                            }}
                          >
                            {/* Reply quote */}
                            {item.replyToMsgId && (
                              <View
                                className={`px-2.5 py-1.5 mb-0.5 rounded-lg border-l-2 max-w-[240px] ${
                                  isMe
                                    ? "border-emerald-400/60 bg-emerald-900/30"
                                    : "border-slate-500 bg-slate-800/80"
                                }`}
                              >
                                <Text
                                  className={`font-semibold text-[11px] ${
                                    isMe ? "text-emerald-200" : "text-slate-300"
                                  }`}
                                >
                                  {realtimeReplySenderName}
                                </Text>
                                <Text
                                  className={`text-[11px] ${
                                    isMe
                                      ? "text-emerald-100/90"
                                      : "text-slate-400"
                                  }`}
                                  numberOfLines={2}
                                >
                                  {item.replyToContent}
                                </Text>
                              </View>
                            )}

                            {/* Ảnh */}
                            {item.fileType?.startsWith("image/") ? (
                              <Image
                                source={{ uri: item.publicUrl }}
                                style={{ backgroundColor: "#1c1c1e" }}
                                className="w-44 h-44 rounded-xl"
                                resizeMode="cover"
                              />
                            ) : item.fileName ? (
                              /* File */
                              <View className="flex-row items-center gap-2.5 p-3 rounded-xl min-w-[150px] max-w-[220px] bg-[#1c1c1e] border border-white/10">
                                <View className="p-2 rounded-lg bg-white/5">
                                  <Feather
                                    name="download"
                                    size={15}
                                    color="#34d399"
                                  />
                                </View>
                                <Text
                                  className="text-sm text-slate-200 flex-1"
                                  numberOfLines={1}
                                  ellipsizeMode="middle"
                                >
                                  {item.fileName}
                                </Text>
                              </View>
                            ) : (
                              /* Text bubble — emerald khi isMe */
                              <View
                                className={`px-3.5 py-2.5 ${
                                  isMe
                                    ? `bg-emerald-600 ${isFirst ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tr-lg"} ${isLast ? "" : "rounded-br-lg"}`
                                    : `bg-[#1c1c1e] ${isFirst ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-tl-lg"} ${isLast ? "" : "rounded-bl-lg"}`
                                }`}
                              >
                                <Text className="text-white text-[15px] leading-5">
                                  {item.content}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          {/* Private label */}
                          {item.isPrivate && (
                            <View
                              className={`flex-row items-center gap-1 mt-0.5 ${
                                isMe ? "justify-end" : "justify-start"
                              }`}
                            >
                              <Feather name="lock" size={10} color="#f59e0b" />
                              <Text className="text-[10px] text-amber-500/90">
                                {isMe
                                  ? t("meeting.chat.private_to_sender", {
                                      name: item.targetIdentity
                                        ? getParticipantDetails(
                                            item.targetIdentity,
                                            item.targetName,
                                          ).displayName
                                        : item.targetName,
                                    })
                                  : t("meeting.chat.private_to_you")}
                              </Text>
                            </View>
                          )}

                          {/* Reactions */}
                          {item.reactions &&
                            Object.values(item.reactions).some(
                              (users) => users.length > 0,
                            ) && (
                              <View
                                className={`flex-row flex-wrap gap-1 mt-0.5 ${
                                  isMe ? "justify-end" : "justify-start"
                                }`}
                              >
                                {Object.entries(item.reactions).map(
                                  ([emoji, users]) => {
                                    if (users.length === 0) return null;
                                    const hasReacted = users.includes(
                                      localParticipant?.identity || "",
                                    );
                                    return (
                                      <TouchableOpacity
                                        key={emoji}
                                        onPress={() =>
                                          handleReact(item.id, emoji)
                                        }
                                        onLongPress={() =>
                                          setReactionDetails(item.reactions!)
                                        }
                                        className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${
                                          hasReacted
                                            ? "bg-emerald-900/40 border-emerald-500/40"
                                            : "bg-[#1c1c1e] border-white/10"
                                        }`}
                                      >
                                        <Text className="text-[11px]">
                                          {emoji}
                                        </Text>
                                        <Text
                                          className={`text-[11px] font-medium ${
                                            hasReacted
                                              ? "text-emerald-400"
                                              : "text-slate-400"
                                          }`}
                                        >
                                          {users.length}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  },
                                )}
                              </View>
                            )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />

          {/* BANNER REPLY */}
          {replyingTo && (
            <View className="px-4 py-2 flex-row justify-between items-center border-t border-white/10 bg-[#0a0a0a]">
              <View className="flex-1 mr-2">
                <Text className="font-semibold text-emerald-400 text-xs mb-0.5">
                  {t("meeting.chat.replying_to", {
                    name: replyingTo.senderName,
                  })}
                </Text>
                <Text className="text-slate-400 text-xs" numberOfLines={1}>
                  {replyingTo.content ||
                    (replyingTo.fileName
                      ? `${t("meeting.chat.file_prefix")} ${replyingTo.fileName}`
                      : t("meeting.chat.media_prefix"))}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                className="p-1.5 bg-white/10 rounded-full"
              >
                <Feather name="x" size={14} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}

          {/* INPUT — paddingBottom theo keyboardHeight, không dùng KAV */}
          {!canChat ? (
            <View
              style={{ paddingBottom: bottomPad }}
              className="px-3 pt-3 border-t border-white/10 items-center justify-center"
            >
              <View className="bg-rose-500/10 px-4 py-2.5 rounded-xl flex-row items-center gap-2 border border-rose-500/20">
                <Feather name="lock" size={15} color="#f87171" />
                <Text className="text-slate-300 text-sm font-medium">
                  {t("meeting.chat.chat_locked")}
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                paddingBottom: Math.max(insets.bottom + 10, 10),
              }}
              className="px-3 pt-2.5 border-t border-white/10 gap-2"
            >
              <TouchableOpacity
                onPress={() => setShowTargetSelector(true)}
                className="self-start px-3 py-1.5 rounded-lg flex-row items-center bg-white/5 border border-white/10"
              >
                <Text className="text-xs font-medium text-slate-300 mr-1.5">
                  {t("meeting.chat.send_label")}{" "}
                  {selectedTarget === "all"
                    ? t("meeting.chat.everyone")
                    : otherParticipants.find(
                        (p) => p.identity === selectedTarget,
                      )?.name || "—"}
                </Text>
                <Feather name="chevron-down" size={13} color="#94a3b8" />
              </TouchableOpacity>

              <View className="flex-row items-center gap-2">
                {isProcessing ? (
                  <View className="flex-1 flex-row justify-center items-center py-2.5 opacity-70">
                    <ActivityIndicator size="small" color="#34d399" />
                    <Text className="text-emerald-400 font-medium ml-2 text-sm">
                      {t("meeting.chat.uploading_file")}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      className="p-2.5 rounded-full bg-white/5"
                    >
                      <Feather name="image" size={18} color="#34d399" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickDocument}
                      className="p-2.5 rounded-full bg-white/5"
                    >
                      <Feather name="paperclip" size={18} color="#34d399" />
                    </TouchableOpacity>

                    <View className="flex-1 rounded-full flex-row items-center px-3.5 bg-white/5 border border-white/10">
                      <TextInput
                        value={inputValue}
                        onChangeText={setInputValue}
                        placeholder={t("meeting.chat.input_placeholder")}
                        placeholderTextColor="#64748b"
                        className="flex-1 py-2.5 text-white text-[15px]"
                        returnKeyType="send"
                        onSubmitEditing={handleSendText}
                      />
                      <TouchableOpacity
                        onPress={handleSendText}
                        disabled={!inputValue.trim()}
                      >
                        <Feather
                          name="send"
                          size={18}
                          color={inputValue.trim() ? "#34d399" : "#475569"}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ===== MODAL CHỌN NGƯỜI NHẬN ===== */}
      <Modal visible={showTargetSelector} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
            paddingBottom: Math.max(insets.bottom, 12),
          }}
          onPress={() => setShowTargetSelector(false)}
        >
          <View className="bg-[#1c1c1e] px-5 pt-5 pb-4 rounded-t-2xl border border-white/10 max-h-[50%]">
            <Text className="text-slate-500 text-xs font-semibold mb-3 uppercase tracking-wide">
              {t("meeting.chat.select_recipient")}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTarget("all");
                  setShowTargetSelector(false);
                }}
                className="flex-row items-center py-3.5 border-b border-white/5"
              >
                <Feather
                  name="users"
                  size={17}
                  color={selectedTarget === "all" ? "#34d399" : "#94a3b8"}
                />
                <Text
                  className={`ml-3 text-[15px] ${
                    selectedTarget === "all"
                      ? "text-emerald-400 font-semibold"
                      : "text-slate-200"
                  }`}
                >
                  {t("meeting.chat.everyone_in_room")}
                </Text>
              </TouchableOpacity>

              {otherParticipants.map((p) => (
                <TouchableOpacity
                  key={p.identity}
                  onPress={() => {
                    setSelectedTarget(p.identity);
                    setShowTargetSelector(false);
                  }}
                  className="flex-row items-center py-3.5 border-b border-white/5"
                >
                  <Feather
                    name="lock"
                    size={15}
                    color={
                      selectedTarget === p.identity ? "#f59e0b" : "#94a3b8"
                    }
                  />
                  <Text
                    className={`ml-3 text-[15px] ${
                      selectedTarget === p.identity
                        ? "text-amber-400 font-semibold"
                        : "text-slate-200"
                    }`}
                  >
                    {t("meeting.chat.send_only_to", { name: p.name })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== ACTION / REACTION ===== */}
      <Modal visible={!!activeMessage} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/60 justify-center items-center px-4"
          onPress={() => setActiveMessage(null)}
        >
          <View
            className="w-full rounded-2xl p-4 bg-[#1c1c1e] border border-white/10"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row justify-between mb-4 border-b border-white/10 pb-4">
              {QUICK_EMOJIS.map((emj) => (
                <TouchableOpacity
                  key={emj}
                  onPress={() =>
                    activeMessage && handleReact(activeMessage.id, emj)
                  }
                  className="p-2 bg-white/5 rounded-full"
                >
                  <Text className="text-2xl">{emj}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              className="flex-row items-center py-2"
              onPress={() => {
                setReplyingTo(activeMessage);
                setActiveMessage(null);
              }}
            >
              <Feather name="corner-up-left" size={18} color="#34d399" />
              <Text className="ml-3 text-[15px] font-medium text-slate-200">
                {t("meeting.chat.reply_message")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== CHI TIẾT CẢM XÚC (theme emerald) ===== */}
      <Modal visible={!!reactionDetails} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/60 justify-center items-center px-4"
          onPress={() => setReactionDetails(null)}
        >
          <View
            className="w-full max-w-[320px] max-h-[60%] rounded-2xl border border-white/10 overflow-hidden bg-[#1c1c1e]"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row justify-between items-center px-4 py-3.5 border-b border-white/10">
              <Text className="text-white font-semibold text-[15px]">
                {t("meeting.chat.reaction_details_title")}
              </Text>
              <TouchableOpacity onPress={() => setReactionDetails(null)}>
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-3" showsVerticalScrollIndicator={false}>
              {reactionDetails &&
                Object.entries(reactionDetails).map(([emoji, users]) => {
                  if (users.length === 0) return null;
                  return (
                    <View key={emoji} className="mb-3">
                      <View className="flex-row items-center gap-2 mb-1.5 border-b border-white/5 pb-1.5">
                        <Text className="text-base">{emoji}</Text>
                        <Text className="text-[11px] text-slate-500 font-medium">
                          {t("meeting.chat.people_count", {
                            count: users.length,
                          })}
                        </Text>
                      </View>
                      {users.map((userId) => {
                        const { displayName, initial, avatarUrl } =
                          getParticipantDetails(userId);
                        return (
                          <View
                            key={userId}
                            className="flex-row items-center gap-2.5 py-1.5 px-1"
                          >
                            {avatarUrl ? (
                              <Image
                                source={{ uri: avatarUrl }}
                                className="w-6 h-6 rounded-full bg-slate-700"
                              />
                            ) : (
                              <View className="w-6 h-6 rounded-full bg-emerald-600 justify-center items-center">
                                <Text className="text-[10px] text-white font-bold">
                                  {initial}
                                </Text>
                              </View>
                            )}
                            <Text className="text-slate-200 text-sm">
                              {displayName}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== PREVIEW MEDIA ===== */}
      <Modal visible={!!previewMedia} transparent animationType="fade">
        <View className="flex-1 bg-black/95 justify-center items-center">
          <TouchableOpacity
            className="absolute top-12 right-4 p-3 z-50 bg-white/10 rounded-full"
            onPress={() => setPreviewMedia(null)}
            style={{ marginTop: insets.top }}
          >
            <Feather name="x" size={22} color="white" />
          </TouchableOpacity>
          {previewMedia && (
            <Image
              source={{ uri: previewMedia.url }}
              className="w-full h-full"
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            className="absolute bottom-14 flex-row items-center bg-[#1c1c1e]/90 px-5 py-3 rounded-full border border-white/10"
            onPress={() => previewMedia && Linking.openURL(previewMedia.url)}
            style={{ marginBottom: insets.bottom }}
          >
            <Feather name="external-link" size={16} color="white" />
            <Text className="text-white ml-2 font-medium text-sm">
              {t("meeting.chat.open_in_browser")}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Modal>
  );
}
