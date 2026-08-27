import { useState, useEffect, useRef } from "react";
import {
  useRoomContext,
  useLocalParticipant,
  useParticipants,
} from "@livekit/react-native";
import { RoomEvent } from "livekit-client";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { ChatMessage } from "@tobomeet/shared/types";
import { toast } from "../lib/toast";
import { useGeneratePresignedUploadUrlMutation } from "../lib/redux/features/meetings/meetingsApi";

export function useChatManager({ meetingCode }: { meetingCode: string }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [generatePresignedUrl] = useGeneratePresignedUploadUrlMutation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Reply, React, Private Chat
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactionDetails, setReactionDetails] = useState<{
    [emoji: string]: string[];
  } | null>(null);
  const [activeMessage, setActiveMessage] = useState<ChatMessage | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("all"); // "all" hoặc "identity" của người dùng

  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😡", "🎉"];

  // Cache lưu tên mới nhất của người dùng đảm bảo nhất quán khi hiển thị
  const participantCache = useRef<
    Record<string, { name: string; avatarUrl: string }>
  >({});

  // Cập nhật cache khi người dùng đổi tên
  useEffect(() => {
    participants.forEach((p) => {
      let avatarUrl = "";
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          avatarUrl = meta.avatar || meta.avatarUrl || meta.picture || "";
        }
      } catch (e) {
        console.error(e);
      }

      // Luôn ghi đè bằng thông tin mới nhất của người dùng
      participantCache.current[p.identity] = {
        name: p.name || "Ẩn danh",
        avatarUrl,
      };
    });
  }, [participants]);

  // Lấy danh sách thành viên khác (để chọn gửi riêng)
  const otherParticipants = participants.filter(
    (p) => p.identity !== localParticipant?.identity,
  );

  // Lắng nghe tin nhắn mới từ livekit data channel
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
        } else if (
          data.type === "REACT" &&
          data.targetMessageId &&
          data.emoji
        ) {
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

  const getParticipantDetails = (id: string, fallbackName?: string) => {
    let name = fallbackName || "Người dùng ẩn danh";
    let avatarUrl = "";

    // Lấy Real-time (Đảm bảo cập nhật tức thì khi đổi tên vì participants kích hoạt render)
    const realtimeP =
      id === localParticipant?.identity
        ? localParticipant
        : participants.find((x) => x.identity === id);

    if (realtimeP) {
      name = realtimeP.name || name;
      try {
        if (realtimeP.metadata) {
          const meta = JSON.parse(realtimeP.metadata);
          avatarUrl = meta.avatar || meta.avatarUrl || meta.picture || "";
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Nếu người dùng đã rời phòng, lấy dữ liệu từ Cache
      const cachedInfo = participantCache.current[id];
      if (cachedInfo) {
        name = cachedInfo.name || name;
        avatarUrl = cachedInfo.avatarUrl || "";
      }
    }

    const displayName = id === localParticipant?.identity ? "Bạn" : name;
    const initial = name.charAt(0).toUpperCase();

    return { displayName, initial, avatarUrl };
  };

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
    setActiveMessage(null);
  };

  // Gửi tin nhắn văn bản (có gửi riêng)
  const handleSendText = async () => {
    if (!inputValue.trim() || !localParticipant) return;

    const isPrivate = selectedTarget !== "all";
    let targetName = "";
    let destinationIdentities: string[] = [];

    if (isPrivate) {
      const targetParticipant = participants.find(
        (p) => p.identity === selectedTarget,
      );
      if (targetParticipant) {
        destinationIdentities = [targetParticipant.identity];
        targetName = targetParticipant.name || "Ẩn danh";
      } else {
        toast.error("Người nhận không có trong phòng hoặc đã rời phòng.");
        return;
      }
    }

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type: "CHAT",
      senderIdentity: localParticipant.identity,
      senderName: localParticipant.name || "Bạn",
      content: inputValue.trim(),
      timestamp: Date.now(),
      isPrivate,
      targetName,
      targetIdentity: isPrivate ? selectedTarget : undefined,
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
      {
        reliable: true,
        ...(destinationIdentities.length > 0 && { destinationIdentities }),
      },
    );

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    setReplyingTo(null);
  };

  // Upload và gửi file
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
        meetingCode,
      }).unwrap();
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": type || "application/octet-stream" },
      });

      if (uploadResult.status !== 200)
        throw new Error("Lỗi khi đẩy file lên cloud");

      const isPrivate = selectedTarget !== "all";
      const fileMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        type: "CHAT",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: Date.now(),
        isPrivate,
        targetName: isPrivate
          ? participants.find((p) => p.identity === selectedTarget)?.name
          : undefined,
        targetIdentity: isPrivate ? selectedTarget : undefined,
        fileName: name,
        fileType: type,
        publicUrl,
        reactions: {},
        ...(replyingTo && {
          replyToMsgId: replyingTo.id,
          replyToSender: replyingTo.senderName,
          replyToContent:
            replyingTo.content || `[Tệp] ${replyingTo.fileName || name}`,
        }),
      };

      const encoder = new TextEncoder();
      let destinationIdentities: string[] = [];
      if (isPrivate) destinationIdentities = [selectedTarget];

      await localParticipant.publishData(
        encoder.encode(JSON.stringify(fileMsg)),
        {
          reliable: true,
          ...(destinationIdentities.length > 0 && { destinationIdentities }),
        },
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

  return {
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
  };
}
