import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Platform,
  Keyboard,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useRoomContext,
  useLocalParticipant,
  useParticipants,
} from "@livekit/react-native";
import { RoomEvent } from "livekit-client";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ChatMessage } from "@tobomeet/shared/types";
import { toast } from "../../lib/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGeneratePresignedUploadUrlMutation } from "../../lib/redux/features/meetings/meetingsApi";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😡", "🎉"];

export default function MobileChatModal({
  visible,
  onClose,
  meetingCode,
}: {
  visible: boolean;
  onClose: () => void;
  meetingCode: string;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants(); // danh sách thành viên

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const insets = useSafeAreaInsets();

  const [isProcessing, setIsProcessing] = useState(false);
  const [generatePresignedUrl] = useGeneratePresignedUploadUrlMutation();
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // State cho Reply & Reaction
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactionDetails, setReactionDetails] = useState<{
    [emoji: string]: string[];
  } | null>(null);
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null); // Lưu tin nhắn đang được nhấn giữ
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    name: string;
  } | null>(null); // Xem ảnh full màn hình

  // LOGIC NHẬN TIN NHẮN
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = async (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload);

      try {
        const data = JSON.parse(jsonString) as ChatMessage;

        if (data.type === "CHAT") {
          data.reactions = data.reactions || {};
          setMessages((prev) => [...prev, data]);
        }
        // Xử lý khi có người thả cảm xúc
        else if (data.type === "REACT" && data.targetMessageId && data.emoji) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === data.targetMessageId) {
                const newReactions = { ...(msg.reactions || {}) };
                const usersWhoReacted = newReactions[data.emoji!] || [];

                if (!usersWhoReacted.includes(data.senderIdentity)) {
                  newReactions[data.emoji!] = [
                    ...usersWhoReacted,
                    data.senderIdentity,
                  ];
                } else {
                  newReactions[data.emoji!] = usersWhoReacted.filter(
                    (id) => id !== data.senderIdentity,
                  );
                }
                return { ...msg, reactions: newReactions };
              }
              return msg;
            }),
          );
        }
      } catch (error) {
        console.log("Lỗi parse tin nhắn:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // LẤY INFO NGƯỜI DÙNG (Cho Reaction Summary)
  const getParticipantDetails = (id: string) => {
    let name = "Người dùng ẩn danh";
    let avatarUrl = "";

    const p =
      id === localParticipant?.identity
        ? localParticipant
        : participants.find((x) => x.identity === id);
    if (p) {
      name = p.name || name;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          avatarUrl = meta.avatar || meta.avatarUrl || meta.picture || "";
        }
      } catch (e) {
        console.error(e);
      }
    }
    const displayName = id === localParticipant?.identity ? "Bạn" : name;
    const initial = name.charAt(0).toUpperCase();
    return { displayName, initial, avatarUrl };
  };

  // THẢ CẢM XÚC
  const handleReact = async (targetMessageId: string, emoji: string) => {
    if (!localParticipant) return;

    const reactMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type: "REACT",
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || "Bạn",
      timestamp: Date.now(),
      isPrivate: false,
      targetMessageId,
      emoji,
    };

    const encoder = new TextEncoder();
    try {
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(reactMsg)),
        { reliable: true },
      );

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === targetMessageId) {
            const newReactions = { ...(msg.reactions || {}) };
            const users = newReactions[emoji] || [];
            if (!users.includes(localParticipant.identity)) {
              newReactions[emoji] = [...users, localParticipant.identity];
            } else {
              newReactions[emoji] = users.filter(
                (id) => id !== localParticipant.identity,
              );
            }
            return { ...msg, reactions: newReactions };
          }
          return msg;
        }),
      );
    } catch (error) {
      console.error(error);
    }

    // Đóng menu sau khi thả tim
    setActiveMessage(null);
  };

  // LOGIC GỬI TEXT (Bổ sung Reply)
  const handleSendText = async () => {
    if (!inputValue.trim() || !localParticipant) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type: "CHAT",
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || "Bạn",
      content: inputValue.trim(),
      timestamp: Date.now(),
      isPrivate: false,
      reactions: {},
      ...(replyingTo && {
        replyToMsgId: replyingTo.id,
        replyToSender: replyingTo.senderName,
        replyToContent:
          replyingTo.content ||
          (replyingTo.fileName
            ? `[Tệp] ${replyingTo.fileName}`
            : "[Ảnh/Video]"),
      }),
    };

    const encoder = new TextEncoder();
    await localParticipant.publishData(
      encoder.encode(JSON.stringify(newMessage)),
      { reliable: true },
    );

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setReplyingTo(null); // Gửi xong thì xóa cờ reply
  };

  // XỬ LÝ GỬI FILE/ẢNH QUA SUPABASE S3
  const processAndSendFile = async (
    uri: string,
    name: string,
    type: string,
    size: number,
  ) => {
    if (size > MAX_FILE_SIZE) {
      toast.error("Chỉ hỗ trợ file dưới 50MB!");
      return;
    }

    setIsProcessing(true);
    try {
      const { presignedUrl, publicUrl } = await generatePresignedUrl({
        fileName: name,
        meetingCode: meetingCode,
      }).unwrap();

      const uploadResult = await FileSystem.uploadAsync(presignedUrl, uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": type || "application/octet-stream" },
      });

      if (uploadResult.status !== 200)
        throw new Error("Lỗi khi đẩy file lên cloud");

      const fileMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        type: "CHAT",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: Date.now(),
        isPrivate: false,
        fileName: name,
        fileType: type,
        publicUrl: publicUrl,
        reactions: {},
        ...(replyingTo && {
          replyToMsgId: replyingTo.id,
          replyToSender: replyingTo.senderName,
          replyToContent:
            replyingTo.content || `[Tệp] ${replyingTo.fileName || name}`,
        }),
      };

      const encoder = new TextEncoder();
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(fileMsg)),
        { reliable: true },
      );

      setMessages((prev) => [...prev, fileMsg]);
      setReplyingTo(null);
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải file lên.");
    } finally {
      setIsProcessing(false);
    }
  };

  // CHỌN ẢNH / FILE
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      processAndSendFile(
        asset.uri,
        asset.fileName || `image_${Date.now()}.jpg`,
        asset.mimeType || "image/jpeg",
        asset.fileSize || 0,
      );
    }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      const doc = result.assets[0];
      processAndSendFile(
        doc.uri,
        doc.name,
        doc.mimeType || "application/octet-stream",
        doc.size || 0,
      );
    }
  };

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end">
        <TouchableOpacity
          activeOpacity={1}
          className="absolute inset-0 bg-black/50"
          onPress={onClose}
        />

        <View
          className="bg-slate-900 rounded-t-3xl overflow-hidden border-t border-slate-700 flex-col"
          style={{ height: "85%" }}
        >
          {/* Header */}
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

          {/* Danh sách tin nhắn */}
          <FlatList
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => {
              const isMe = item.senderIdentity === localParticipant.identity;
              return (
                <View
                  className={`flex max-w-[85%] ${isMe ? "self-end" : "self-start"}`}
                >
                  <Text
                    className={`text-xs mb-1 text-slate-400 ${isMe ? "text-right" : "text-left"}`}
                  >
                    {isMe ? "Bạn" : item.senderName}
                  </Text>

                  {/* CHẠM ĐỂ XEM/TẢI FILE, NHẤN GIỮ ĐỂ THẢ TIM */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    delayLongPress={250}
                    onLongPress={() => setActiveMessage(item)}
                    onPress={() => {
                      if (item.publicUrl) {
                        if (item.fileType?.startsWith("image/")) {
                          // Xem ảnh full màn hình
                          setPreviewMedia({
                            url: item.publicUrl,
                            name: item.fileName || "image",
                          });
                        } else {
                          // Bắn link ra trình duyệt ngoài để điện thoại tự động tải file về
                          Linking.openURL(item.publicUrl);
                        }
                      }
                    }}
                    className="relative"
                  >
                    {item.replyToMsgId && (
                      <View
                        className={`text-[11px] mt-0.5 px-2 py-1.5 mb-1 rounded border-l-2 ${isMe ? "border-emerald-300 bg-emerald-700/30" : "border-blue-400 bg-slate-800"} opacity-80`}
                      >
                        <Text
                          className={`font-semibold text-xs ${isMe ? "text-emerald-100" : "text-slate-300"}`}
                        >
                          {item.replyToSender}
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
                      // Đã fix lỗi tên file, thêm ellipsizeMode="middle" và set width an toàn
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

                  {/* KHỐI HIỂN THỊ REACTION BÊN DƯỚI TIN NHẮN */}
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

          {/* BANNER HIỂN THỊ ĐANG TRẢ LỜI AI ĐÓ NẰM TRÊN INPUT */}
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

          {/* Khung nhập liệu & Nút gửi */}
          <View className="p-3 border-t border-slate-800 bg-slate-900 flex-row items-center gap-2 shrink-0">
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

          {/* CỤC ĐỆM BÀN PHÍM */}
          <View
            style={{
              height:
                keyboardHeight > 0
                  ? keyboardHeight
                  : Math.max(insets.bottom, 12),
            }}
          />
        </View>
      </View>

      {/* MENU ACTION (Mở khi nhấn giữ tin nhắn) */}
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
            {/* Hàng Emoji */}
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

            {/* Nút Reply */}
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

      {/* XEM CHI TIẾT AI ĐÃ THẢ CẢM XÚC (Reaction Summary) */}
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

      {/* XEM ẢNH FULL MÀN HÌNH */}
      <Modal visible={!!previewMedia} transparent animationType="fade">
        <View className="flex-1 bg-black/95 justify-center items-center">
          {/* Nút Đóng */}
          <TouchableOpacity
            className="absolute top-12 right-4 p-3 z-50 bg-slate-800/50 rounded-full"
            onPress={() => setPreviewMedia(null)}
          >
            <Feather name="x" size={24} color="white" />
          </TouchableOpacity>

          {/* Khung chứa ẢNH */}
          {previewMedia && (
            <Image
              source={{ uri: previewMedia.url }}
              className="w-full h-full"
              resizeMode="contain"
            />
          )}

          {/* Nút Mở ra trình duyệt để lưu về điện thoại */}
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
