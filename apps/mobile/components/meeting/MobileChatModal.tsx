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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoomContext, useLocalParticipant } from "@livekit/react-native";
import { RoomEvent } from "livekit-client";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ChatMessage } from "@tobomeet/shared/types";
import { toast } from "../../lib/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGeneratePresignedUploadUrlMutation } from "../../lib/redux/features/meetings/meetingsApi";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const insets = useSafeAreaInsets();

  const [isProcessing, setIsProcessing] = useState(false);
  const [generatePresignedUrl] = useGeneratePresignedUploadUrlMutation();
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // tối đa 50MB

  // LOGIC NHẬN TIN NHẮN
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = async (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload);

      try {
        const data = JSON.parse(jsonString) as ChatMessage;

        // Chỉ cần xử lý đúng 1 loại CHAT (Text và Link S3 đều chung loại này)
        if (data.type === "CHAT") {
          setMessages((prev) => [...prev, data]);
        }
        // Có thể thêm logic REACT ở đây nếu bạn muốn phát triển tiếp
      } catch (error) {
        console.log("Lỗi parse tin nhắn:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // LOGIC GỬI TEXT
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
    };

    const encoder = new TextEncoder();
    await localParticipant.publishData(
      encoder.encode(JSON.stringify(newMessage)),
      { reliable: true },
    );

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
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
      // 1. Gọi API lấy link upload
      const { presignedUrl, publicUrl } = await generatePresignedUrl({
        fileName: name,
        meetingCode: meetingCode,
      }).unwrap();

      // 2. Dùng FileSystem.uploadAsync để đẩy thẳng file không làm đầy RAM
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, uri, {
        httpMethod: "PUT",
        headers: {
          "Content-Type": type || "application/octet-stream",
        },
      });

      if (uploadResult.status !== 200) {
        throw new Error("Lỗi khi đẩy file lên cloud");
      }

      // 3. Đẩy tin nhắn vào LiveKit với publicUrl
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
      };

      const encoder = new TextEncoder();
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(fileMsg)),
        { reliable: true },
      );

      setMessages((prev) => [...prev, fileMsg]);
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
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";
      processAndSendFile(asset.uri, fileName, mimeType, asset.fileSize || 0);
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

  // LẮNG NGHE BÀN PHÍM VÀ UI
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

                  {item.fileType?.startsWith("image/") ? (
                    <Image
                      source={{ uri: item.publicUrl }}
                      className="w-48 h-48 rounded-xl bg-slate-800"
                      resizeMode="cover"
                    />
                  ) : item.fileName ? (
                    <View className="flex-row items-center gap-3 bg-slate-800 p-3 rounded-xl border border-slate-700">
                      <Feather name="file-text" size={24} color="#3b82f6" />
                      <Text
                        className="text-slate-200 text-sm flex-1 truncate"
                        numberOfLines={1}
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
                </View>
              );
            }}
          />

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
    </Modal>
  );
}
