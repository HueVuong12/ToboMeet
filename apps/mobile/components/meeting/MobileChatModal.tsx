import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoomContext, useLocalParticipant } from "@livekit/react-native";
import { RoomEvent } from "livekit-client";

// 3 Thư viện mới cài
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { ChatMessage } from "@tobomeet/shared/types";
import { toast } from "../../lib/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CHUNK_SIZE = 16 * 1024; // 16KB mỗi gói tin

export default function MobileChatModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const insets = useSafeAreaInsets();

  const fileReceiveBuffer = useRef<{ [fileId: string]: string[] }>({});

  // LOGIC NHẬN TIN NHẮN & FILE TỪ LIVEKIT
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = async (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(payload);

      try {
        const data = JSON.parse(jsonString) as ChatMessage;

        // Nhận Text
        if (data.type === "CHAT" && !data.fileId) {
          setMessages((prev) => [...prev, data]);
        }

        // Nhận File - Bắt đầu
        else if (data.type === "FILE_START" && data.fileId) {
          fileReceiveBuffer.current[data.fileId] = new Array(data.totalChunks);
        }

        // Nhận File - Từng mảnh
        else if (
          data.type === "FILE_CHUNK" &&
          data.fileId &&
          data.chunkData !== undefined
        ) {
          fileReceiveBuffer.current[data.fileId][data.chunkIndex!] =
            data.chunkData;
        }

        // Nhận File - Kết thúc & Ráp lại
        else if (data.type === "FILE_DONE" && data.fileId) {
          const buffer = fileReceiveBuffer.current[data.fileId];
          const allBase64 = buffer.join("");

          // KHÁC BIỆT VỚI WEB: Lưu file thẳng vào bộ nhớ đệm của điện thoại
          const fileUri = `${FileSystem.cacheDirectory}${data.fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, allBase64, {
            encoding: "base64",
          });

          const finalMessage: ChatMessage = {
            id: data.id,
            type: "CHAT",
            senderIdentity: data.senderIdentity,
            senderName: data.senderName,
            timestamp: data.timestamp,
            fileName: data.fileName,
            fileType: data.fileType,
            isPrivate: data.isPrivate || false,
            chunkData: fileUri, // Sử dụng URI của điện thoại (file://...)
          };

          setMessages((prev) => [...prev, finalMessage]);
          delete fileReceiveBuffer.current[data.fileId];
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

  // LOGIC XỬ LÝ GỬI FILE/ẢNH (DÙNG CHUNG)
  const processAndSendFile = async (
    uri: string,
    name: string,
    type: string,
    size: number,
  ) => {
    if (size > 100 * 1024 * 1024) {
      Alert.alert("Lỗi", "Chỉ hỗ trợ file dưới 100MB!");
      return;
    }

    try {
      // Đọc file từ điện thoại thành chuỗi Base64
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const fileId = Math.random().toString(36).substring(2, 15);
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
      const encoder = new TextEncoder();

      // 3.1 Gửi tín hiệu BẮT ĐẦU
      const startMsg: ChatMessage = {
        id: fileId,
        type: "FILE_START",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: Date.now(),
        fileId,
        isPrivate: false,
        fileName: name,
        fileSize: size,
        fileType: type,
        totalChunks,
      };
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(startMsg)),
        { reliable: true },
      );

      // 3.2 Gửi TỪNG MẢNH (Vòng lặp)
      for (let i = 0; i < totalChunks; i++) {
        const chunkStr = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkMsg: ChatMessage = {
          id: Math.random().toString(36).substring(2, 9),
          type: "FILE_CHUNK",
          fileId,
          isPrivate: false,
          senderIdentity: localParticipant.identity,
          senderName: localParticipant.name || "Bạn",
          chunkIndex: i,
          chunkData: chunkStr,
          timestamp: Date.now(),
        };
        await localParticipant.publishData(
          encoder.encode(JSON.stringify(chunkMsg)),
          { reliable: true },
        );
        await new Promise((resolve) => setTimeout(resolve, 5)); // Chống nghẽn mạng
      }

      // 3.3 Gửi tín hiệu KẾT THÚC
      const doneMsg: ChatMessage = {
        ...startMsg,
        id: fileId,
        type: "FILE_DONE",
      };
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(doneMsg)),
        { reliable: true },
      );

      // Hiển thị lên màn hình của mình
      setMessages((prev) => [
        ...prev,
        {
          ...startMsg,
          type: "CHAT",
          chunkData: uri, // Dùng luôn URI gốc của máy để hiển thị cho nhanh
        },
      ]);
    } catch (error) {
      console.error(error);
      toast.error("Không thể xử lý file này.");
    }
  };

  // PICKER: CHỌN ẢNH TỪ GALLERY
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Chỉ chọn ảnh/video
      quality: 0.7, // Giảm chất lượng xíu để gửi cho nhanh
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";
      processAndSendFile(asset.uri, fileName, mimeType, asset.fileSize || 0);
    }
  };

  // PICKER: CHỌN FILE TỪ ĐIỆN THOẠI
  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*", // Cho phép chọn mọi loại file (PDF, Word, Excel...)
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

  // 1. THÊM STATE VÀ EFFECT ĐỂ LẮNG NGHE BÀN PHÍM
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // iOS dùng WillShow cho mượt, Android dùng DidShow cho chính xác
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

  // 2. GIAO DIỆN CHAT ĐÃ FIX
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end">
        {/* Lớp nền đen mờ */}
        <TouchableOpacity
          activeOpacity={1}
          className="absolute inset-0 bg-black/50"
          onPress={onClose}
        />

        {/* Khung Chat cố định 85% màn hình */}
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

          {/* Danh sách tin nhắn - BẮT BUỘC PHẢI CÓ style={{ flex: 1 }} */}
          <FlatList
            style={{ flex: 1 }} // <--- CHÌA KHÓA QUAN TRỌNG ĐỂ KHÔNG BỊ CHE INPUT
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
                      source={{ uri: item.chunkData }}
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

          {/* Khung nhập liệu & Nút gửi File (Loại bỏ hoàn toàn paddingBottom ở đây) */}
          <View className="p-3 border-t border-slate-800 bg-slate-900 flex-row items-center gap-2 shrink-0">
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
          </View>

          {/* CỤC ĐỆM BÀN PHÍM (SPACER) */}
          {/* Khi bàn phím bật, cục này sẽ cao bằng bàn phím, đẩy chính xác Input Bar lên mép */}
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
