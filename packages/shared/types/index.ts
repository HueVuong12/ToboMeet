// Shared TypeScript interfaces — dùng chung cho Web, Mobile, Desktop, Server

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface UserResponse {
  _id: string;
  email: string;
  supabaseId: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Meeting ──────────────────────────────────────────────────────────────────
export interface Meeting {
  id: string;
  roomCode: string;
  title?: string;
  hostId: string;
  participants: Participant[];
  startedAt: string;
  endedAt?: string;
  isActive: boolean;
}

export interface Participant {
  userId: string;
  name: string;
  avatarUrl?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  joinedAt: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export interface ErrorDetail {
  code: number;
  message: string;
  statusCode: number; // Dùng để NestJS biết nên trả về 400, 404 hay 500
}

export const ErrorCode: Record<string, ErrorDetail> = {
  USER_NOT_FOUND: {
    code: 4041,
    message: "Người dùng không tồn tại",
    statusCode: 404,
  },
  ACCOUNT_LOCKED: {
    code: 4031,
    message: "Tài khoản của bạn đã bị khóa",
    statusCode: 403,
  },
  INVALID_TOKEN: {
    code: 4011,
    message: "Token không hợp lệ hoặc đã hết hạn",
    statusCode: 401,
  },
  INVALID_CREDENTIALS: {
    code: 4012,
    message: "Email hoặc mật khẩu không đúng",
    statusCode: 401,
  },
  ALREADY_IN_MEETING: {
    code: 4013,
    message: "Đã trong cuộc họp",
    statusCode: 401,
  },
  ROOM_OR_CHANNEL_NOT_FOUND: {
    code: 4041,
    message: "Phòng hoặc kênh không tồn tại",
    statusCode: 404,
  },
  USER_EXISTED: {
    code: 4001,
    message: "Email này đã được sử dụng",
    statusCode: 400,
  },
  UNAUTHORIZED: {
    code: 4011,
    message: "Vui lòng đăng nhập để tiếp tục",
    statusCode: 401,
  },
  ROOM_FULL: {
    code: 4002,
    message: "Phòng họp đã đạt số lượng tối đa",
    statusCode: 400,
  },
  // Lỗi hệ thống (50x), không public lỗi chi tiết cho người dùng
  SERVER_ERROR: {
    code: 5011,
    message: "Lỗi hệ thống, vui lòng thử lại sau",
    statusCode: 501,
  },
};

// ─── Navigation ───────────────────────────────────────────────────────────────
export interface NavLink {
  label: string;
  href: string;
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
export interface Feature {
  iconName: string;
  title: string;
  description: string;
  gradient: string;
}

export interface Platform {
  iconName: string;
  name: string;
  badges: string[];
  description: string;
}

// ─── Room ────────────────────────────────────────────────────────────────────
export interface Channel {
  _id?: string;
  name: string;
  createdAt: string;
}

export interface RoomResponse {
  _id: string;
  name: string;
  description?: string;
  type: "meeting" | "classroom";
  code: string;
  ownerId: string;
  members?: RoomMemberResponse[];
  channels: Channel[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomMemberResponse {
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
}

export interface MeetingJoinResponse {
  token: string;
  meetingCode: string;
  status: string;
  isHost: boolean;

  roomId: string;
  channelId: string;
  channelName: string;
}

export interface ActiveMeetingResponse {
  isOngoing: boolean;
  meetingCode: string | null;
  hostId: string;
}

export type PacketType = "CHAT" | "REACT";

// Cấu trúc gói tin chat trong meeting (dùng chung cho Web, Mobile, Desktop)
export interface ChatMessage {
  id: string;
  type: PacketType;
  senderIdentity: string;
  senderName: string;
  content?: string;
  timestamp: number;
  isPrivate: boolean;
  targetName?: string; // Tên người nhận (để hiển thị UI cho người gửi)

  // Dành cho FILE_START & FILE_DONE
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  publicUrl?: string;

  // Dành cho tính năng Reply
  replyToMsgId?: string;
  replyToSender?: string;
  replyToContent?: string;

  // Dành cho tính năng Thả cảm xúc
  reactions?: { [emoji: string]: string[] }; // Lưu theo dạng: { "👍": ["user_id_1", "user_id_2"] }
  targetMessageId?: string; // (Chỉ dùng cho loại gói tin REACT)
  emoji?: string; // (Chỉ dùng cho loại gói tin REACT)
}

export interface PresignedUploadResponse {
  presignedUrl: string;
  publicUrl: string;
}
