export interface ChatAttachment {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: "image" | "video" | "file";
}

export interface ChatMessageReaction {
  emoji: string;
  userIds: string[];
}

export interface ChatParticipant {
  supabaseId: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  status?: string;
}

export interface DirectConversationResponse {
  id: string;
  participantIds: string[];
  recipient: ChatParticipant;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessageResponse {
  id: string;
  _id?: string;
  conversationId: string;
  senderId: string;
  sender?: ChatParticipant;
  type: "text" | "file" | "video" | "image";
  content: string;
  attachments: ChatAttachment[];
  replyToId?: {
    _id: string;
    content: string;
    senderId: string;
    type: "text" | "file" | "video" | "image";
    attachments?: ChatAttachment[];
    deletedAt?: string | null;
  } | null;
  reactions: ChatMessageReaction[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessagesPaginationResponse {
  messages: DirectMessageResponse[];
  hasMore: boolean;
  nextCursor: string | null;
}
