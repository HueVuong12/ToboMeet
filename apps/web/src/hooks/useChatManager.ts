import { useState, useEffect, useRef } from "react";
import {
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { toast } from "sonner";
import { ChatMessage } from "@tobomeet/shared/types";
import { useGeneratePresignedUploadUrlMutation } from "@/lib/redux/api/meetingsApi";
import { useTranslations } from "next-intl";

interface UseChatManagerProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  meetingCode: string;
}

export function useChatManager({
  messages,
  setMessages,
  meetingCode,
}: UseChatManagerProps) {
  const tServer = useTranslations("server.errors");
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [generatePresignedUrl] = useGeneratePresignedUploadUrlMutation();

  // Quản lý State cục bộ
  const [inputValue, setInputValue] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("all");
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [reactionDetails, setReactionDetails] = useState<{
    [emoji: string]: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const participantCache = useRef<
    Record<string, { name: string; avatarUrl: string }>
  >({});

  useEffect(() => {
    participants.forEach((p) => {
      let avatarUrl = "";
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          avatarUrl = meta.avatar || meta.avatarUrl || meta.picture || "";
        }
      } catch (e) {}

      // Luôn ghi đè thông tin mới nhất vào Cache
      participantCache.current[p.identity] = {
        name: p.name || "Ẩn danh",
        avatarUrl,
      };
    });
  }, [participants]);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😡", "🎉"];

  const otherParticipants = participants.filter(
    (p) => p.identity !== localParticipant?.identity,
  );

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Khoảng cách (pixel) tính từ dưới lên để coi như là đang "ở cuối"
    // Nếu họ lướt lên khoảng 100px so với đáy, ta sẽ không tự cuộn nữa.
    const threshold = 100;

    // Kiểm tra xem vị trí cuộn hiện tại + chiều cao nhìn thấy có GẦN BẰNG tổng chiều cao không
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold;

    if (isAtBottom) {
      // Chỉ cuộn mượt khi họ đang ở gần đáy
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Xử lý gửi tin nhắn Text
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    try {
      await localParticipant.publishData(
        encoder.encode(JSON.stringify(newMessage)),
        {
          reliable: true,
          destinationIdentities: destinationIdentities,
        },
      );
      setMessages((prev) => [...prev, newMessage]);
      setInputValue("");
      setReplyingTo(null);
    } catch (error) {
      toast.error("Gửi tin nhắn thất bại. Vui lòng thử lại.");
    }
  };

  // Xử lý Upload và Gửi File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !localParticipant) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Chỉ hỗ trợ file dưới 50MB!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const toastId = toast.loading(`Đang tải lên ${file.name}...`);

    try {
      const { presignedUrl, publicUrl } = await generatePresignedUrl({
        fileName: file.name,
        meetingCode: meetingCode,
      }).unwrap();

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok)
        throw new Error("Lỗi khi tải file lên máy chủ lưu trữ");

      const isPrivate = selectedTarget !== "all";
      const fileMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        type: "CHAT",
        senderIdentity: localParticipant.identity,
        senderName: localParticipant.name || "Bạn",
        timestamp: Date.now(),
        isPrivate: isPrivate,
        targetName: isPrivate
          ? participants.find((p) => p.identity === selectedTarget)?.name
          : undefined,
        targetIdentity: isPrivate ? selectedTarget : undefined,
        fileName: file.name,
        fileType: file.type,
        publicUrl: publicUrl,
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
      toast.success("Tải file thành công!", { id: toastId });
    } catch (error: any) {
      console.error(error);
      const msg =
        (error?.code && tServer(String(error.code))) || "Lỗi tải file lên";
      toast.error(msg, { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Xử lý thả cảm xúc
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
    } catch (error) {}
  };

  // Lấy chi tiết thông tin người dùng
  const getParticipantDetails = (id: string, fallbackName?: string) => {
    let name = fallbackName || "Người dùng ẩn danh";
    let avatarUrl = "";

    // A. ƯU TIÊN 1: Lấy Real-time (Đảm bảo cập nhật tức thì khi đổi tên vì participants kích hoạt render)
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
      } catch (e) {}
    } else {
      // B. ƯU TIÊN 2: Nếu người dùng đã rời phòng, lấy dữ liệu từ Cache
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

  return {
    localParticipant,
    otherParticipants,
    inputValue,
    setInputValue,
    replyingTo,
    setReplyingTo,
    selectedTarget,
    setSelectedTarget,
    previewMedia,
    setPreviewMedia,
    reactionDetails,
    setReactionDetails,
    scrollContainerRef,
    fileInputRef,
    QUICK_EMOJIS,
    handleSendMessage,
    handleFileChange,
    handleReact,
    getParticipantDetails,
  };
}
