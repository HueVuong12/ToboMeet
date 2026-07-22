import React, { useState } from "react";
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
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatStatus } from "../../hooks/useChatStatus";
import { useChatManager } from "../../hooks/useChatManager";

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
  const insets = useSafeAreaInsets();

  // Hook Quyền Chat
  const { canChat } = useChatStatus({ roomId, channelId, meetingCode });

  // Hook Logic Chat (Nhắn tin riêng, Reply, React, Files...)
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

  // State cục bộ mở Modal chọn người nhận
  const [showTargetSelector, setShowTargetSelector] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableOpacity
        activeOpacity={1}
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
      >
        <View className="bg-slate-900 flex-1 mt-24 rounded-t-3xl overflow-hidden border-t border-slate-700 flex-col">
          {/* HEADER */}
          <View className="flex-row justify-between items-center p-4 border-b border-slate-800 shrink-0">
            <Text className="text-white font-bold text-lg">
              Trò chuyện trong phòng
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 bg-slate-800 rounded-full"
            >
              <Feather name="x" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* DANH SÁCH TIN NHẮN */}
          <FlatList
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => {
              const isMe = item.senderIdentity === localParticipant?.identity;
              const { displayName: realtimeSenderName } = getParticipantDetails(
                item.senderIdentity,
                item.senderName,
              );

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
                  className={`flex max-w-[85%] ${isMe ? "self-end" : "self-start"}`}
                >
                  <View
                    className={`flex-row items-center mb-1 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <Text className="text-xs text-slate-400">
                      {realtimeSenderName}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
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
                    className={`relative ${isMe ? "self-end" : "self-start"}`}
                  >
                    {item.replyToMsgId && (
                      <View
                        className={`text-[11px] mt-0.5 px-2 py-1.5 mb-1 rounded border-l-2 ${isMe ? "border-emerald-300 bg-emerald-700/30" : "border-blue-400 bg-slate-800"} opacity-80`}
                      >
                        <Text
                          className={`font-semibold text-xs ${isMe ? "text-emerald-100" : "text-slate-300"}`}
                        >
                          {realtimeReplySenderName}
                        </Text>
                        <Text
                          className={`text-[11px] ${isMe ? "text-emerald-100" : "text-slate-300"}`}
                          numberOfLines={2}
                        >
                          {item.replyToContent}
                        </Text>
                      </View>
                    )}
                    {item.fileType?.startsWith("image/") ? (
                      <Image
                        source={{ uri: item.publicUrl }}
                        className="w-48 h-48 rounded-xl bg-slate-800"
                        resizeMode="cover"
                      />
                    ) : item.fileName ? (
                      <View className="flex-row items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700 min-w-[160px] max-w-[240px]">
                        <View className="bg-slate-700 p-2 rounded-lg shrink-0">
                          <Feather name="download" size={16} color="#3b82f6" />
                        </View>
                        <Text
                          className="text-slate-200 text-sm flex-1"
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {item.fileName}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className={`px-4 py-3 rounded-2xl ${isMe ? "bg-blue-600 rounded-tr-sm" : "bg-slate-700 rounded-tl-sm"}`}
                      >
                        <Text className="text-white text-base">
                          {item.content}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Nhãn gửi riêng */}
                  {item.isPrivate && (
                    <View
                      className={`flex-row items-center gap-1 mt-1 opacity-80 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <Feather name="lock" size={10} color="#f59e0b" />
                      <Text className="text-[10px] text-amber-500">
                        {isMe
                          ? `Gửi riêng cho ${
                              item.targetIdentity
                                ? getParticipantDetails(
                                    item.targetIdentity,
                                    item.targetName,
                                  ).displayName
                                : item.targetName // Fallback an toàn nếu tin nhắn cũ chưa có targetIdentity
                            }`
                          : "Gửi riêng cho bạn"}
                      </Text>
                    </View>
                  )}

                  {/* Reaction */}
                  {item.reactions &&
                    Object.values(item.reactions).some(
                      (users) => users.length > 0,
                    ) && (
                      <View
                        className={`flex-row flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}
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
                                onPress={() => handleReact(item.id, emoji)}
                                onLongPress={() =>
                                  setReactionDetails(item.reactions!)
                                }
                                className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full border ${hasReacted ? "bg-slate-700 border-emerald-500" : "bg-slate-800 border-slate-700"}`}
                              >
                                <Text className="text-[11px]">{emoji}</Text>
                                <Text
                                  className={`text-[11px] font-medium ${hasReacted ? "text-emerald-400" : "text-slate-300"}`}
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
            }}
          />

          {/* BANNER REPLY */}
          {replyingTo && (
            <View className="bg-slate-800 px-4 py-2 flex-row justify-between items-center border-t border-slate-700">
              <View className="flex-1 mr-2">
                <Text className="font-semibold text-emerald-400 text-xs mb-0.5">
                  Đang trả lời {replyingTo.senderName}:
                </Text>
                <Text className="text-slate-300 text-xs" numberOfLines={1}>
                  {replyingTo.content ||
                    (replyingTo.fileName
                      ? `[Tệp] ${replyingTo.fileName}`
                      : "[Ảnh/Video]")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                className="p-1.5 bg-slate-700 rounded-full"
              >
                <Feather name="x" size={14} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}

          {/* KHU VỰC NHẬP LIỆU */}
          {!canChat ? (
            <View
              className="p-3 border-t mb-2 border-slate-800 bg-slate-900 flex-row items-center justify-center gap-2 shrink-0"
              style={{ paddingBottom: Math.max(insets.bottom, 12), height: 75 }}
            >
              <View className="bg-red-500/10 px-4 py-2.5 rounded-xl flex-row items-center gap-2 border border-red-500/20">
                <Feather name="lock" size={16} color="#f87171" />
                <Text className="text-slate-300 text-sm font-medium">
                  Chủ phòng đã khóa chat
                </Text>
              </View>
            </View>
          ) : (
            <View
              className="p-3 border-t mb-2 border-slate-800 bg-slate-900 flex-col gap-2 shrink-0"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              {/* DROPDOWN CHỌN NGƯỜI NHẬN */}
              <TouchableOpacity
                onPress={() => setShowTargetSelector(true)}
                className="self-start px-3 py-1.5 bg-slate-800 rounded-lg flex-row items-center border border-slate-700 mb-1"
              >
                <Text className="text-slate-300 text-xs font-medium mr-1.5">
                  Gửi:{" "}
                  {selectedTarget === "all"
                    ? "Mọi người"
                    : otherParticipants.find(
                        (p) => p.identity === selectedTarget,
                      )?.name || "Ẩn danh"}
                </Text>
                <Feather name="chevron-down" size={14} color="#94a3b8" />
              </TouchableOpacity>

              <View className="flex-row items-center gap-2">
                {isProcessing ? (
                  <View className="flex-1 flex-row justify-center items-center py-2 opacity-70">
                    <ActivityIndicator size="small" color="#10b981" />
                    <Text className="text-emerald-400 font-medium ml-2 text-sm">
                      Đang tải file lên...
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      className="p-2.5 rounded-full bg-slate-800"
                    >
                      <Feather name="image" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickDocument}
                      className="p-2.5 rounded-full bg-slate-800"
                    >
                      <Feather name="paperclip" size={20} color="#10b981" />
                    </TouchableOpacity>
                    <View className="flex-1 bg-slate-800 rounded-full flex-row items-center px-4 border border-slate-700">
                      <TextInput
                        value={inputValue}
                        onChangeText={setInputValue}
                        placeholder="Nhập tin nhắn..."
                        placeholderTextColor="#64748b"
                        className="flex-1 py-3 text-white text-base"
                      />
                      <TouchableOpacity
                        onPress={handleSendText}
                        disabled={!inputValue.trim()}
                      >
                        <Feather
                          name="send"
                          size={20}
                          color={inputValue.trim() ? "#3b82f6" : "#475569"}
                        />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* MODAL CHỌN NGƯỜI NHẬN (BOTTOM SHEET) */}
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
          <View
            style={{
              backgroundColor: "#1e293b",
              padding: 20,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "50%",
            }}
          >
            <Text
              style={{
                color: "#94a3b8",
                fontSize: 14,
                fontWeight: "bold",
                marginBottom: 16,
                textTransform: "uppercase",
              }}
            >
              Chọn người nhận
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTarget("all");
                  setShowTargetSelector(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: "#334155",
                }}
              >
                <Feather
                  name="users"
                  size={18}
                  color={selectedTarget === "all" ? "#3b82f6" : "#94a3b8"}
                />
                <Text
                  style={{
                    color: selectedTarget === "all" ? "#3b82f6" : "#e2e8f0",
                    marginLeft: 12,
                    fontSize: 16,
                    fontWeight: selectedTarget === "all" ? "600" : "normal",
                  }}
                >
                  Mọi người trong phòng
                </Text>
              </TouchableOpacity>

              {otherParticipants.map((p) => (
                <TouchableOpacity
                  key={p.identity}
                  onPress={() => {
                    setSelectedTarget(p.identity);
                    setShowTargetSelector(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "#334155",
                  }}
                >
                  <Feather
                    name="lock"
                    size={16}
                    color={
                      selectedTarget === p.identity ? "#f59e0b" : "#94a3b8"
                    }
                  />
                  <Text
                    style={{
                      color:
                        selectedTarget === p.identity ? "#f59e0b" : "#e2e8f0",
                      marginLeft: 12,
                      fontSize: 16,
                      fontWeight:
                        selectedTarget === p.identity ? "600" : "normal",
                    }}
                  >
                    Chỉ gửi cho: {p.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL ACTION & REACTION & MEDIA (Giữ nguyên như trước) */}
      <Modal visible={!!activeMessage} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/60 justify-center items-center px-4"
          onPress={() => setActiveMessage(null)}
        >
          <View
            className="bg-slate-800 w-full rounded-2xl border border-slate-700 p-4"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row justify-between mb-4 border-b border-slate-700 pb-4">
              {QUICK_EMOJIS.map((emj) => (
                <TouchableOpacity
                  key={emj}
                  onPress={() =>
                    activeMessage && handleReact(activeMessage.id, emj)
                  }
                  className="p-2 bg-slate-700 rounded-full"
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
              <Feather name="corner-up-left" size={20} color="#3b82f6" />
              <Text className="text-white ml-3 text-base font-medium">
                Trả lời tin nhắn này
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!reactionDetails} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/60 justify-center items-center px-4"
          onPress={() => setReactionDetails(null)}
        >
          <View
            className="bg-slate-800 w-full max-w-[320px] max-h-[60%] rounded-2xl border border-slate-700 overflow-hidden"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row justify-between items-center p-4 border-b border-slate-700">
              <Text className="text-white font-bold">Chi tiết cảm xúc</Text>
              <TouchableOpacity onPress={() => setReactionDetails(null)}>
                <Feather name="x" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
              {reactionDetails &&
                Object.entries(reactionDetails).map(([emoji, users]) => {
                  if (users.length === 0) return null;
                  return (
                    <View key={emoji} className="mb-4">
                      <View className="flex-row items-center gap-2 mb-2 border-b border-slate-700/50 pb-1">
                        <Text className="text-lg">{emoji}</Text>
                        <Text className="text-xs text-slate-400 font-medium">
                          {users.length} người
                        </Text>
                      </View>
                      {users.map((userId) => {
                        const { displayName, initial, avatarUrl } =
                          getParticipantDetails(userId);
                        return (
                          <View
                            key={userId}
                            className="flex-row items-center gap-3 py-1.5 px-2"
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

      <Modal visible={!!previewMedia} transparent animationType="fade">
        <View className="flex-1 bg-black/95 justify-center items-center">
          <TouchableOpacity
            className="absolute top-12 right-4 p-3 z-50 bg-slate-800/50 rounded-full"
            onPress={() => setPreviewMedia(null)}
          >
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>
          {previewMedia && (
            <Image
              source={{ uri: previewMedia.url }}
              className="w-full h-full"
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            className="absolute bottom-14 flex-row items-center bg-slate-800/80 px-5 py-3 rounded-full border border-slate-600"
            onPress={() => previewMedia && Linking.openURL(previewMedia.url)}
          >
            <Feather name="external-link" size={18} color="white" />
            <Text className="text-white ml-2 font-medium">
              Mở trong trình duyệt
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Modal>
  );
}
