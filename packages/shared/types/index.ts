// Shared TypeScript interfaces — dùng chung cho Web, Mobile, Desktop, Server

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface UserResponse {
  _id: string;
  email: string;
  supabaseId: string;
  displayName?: string;
  avatarUrl?: string;
  hasUnreadNotifications?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  ROOM_OR_CHANNEL_NOT_FOUND: {
    code: 4041,
    message: "Phòng hoặc kênh không tồn tại",
    statusCode: 404,
  },
  ACCOUNT_LOCKED: {
    code: 4031,
    message: "Tài khoản của bạn đã bị khóa",
    statusCode: 403,
  },
  INVALID_PERMISSION: {
    code: 4032,
    message: "Bạn không đủ quyền thực hiện chức năng này",
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
  MEETING_NOT_STARTED_OR_ENDED: {
    code: 4014,
    message: "Cuộc họp chưa bắt đầu hoặc đã kết thúc",
    statusCode: 401,
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

export interface ChannelResponse {
  _id: string;
  name: string;
  members?: ChannelMemberResponse[];
  isPrivate: boolean;
  createdAt: string;
}

export interface RoomResponse {
  _id: string;
  name: string;
  description?: string;
  code: string;
  ownerId: string;
  members?: RoomMemberResponse[];
  channels: ChannelResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomMemberResponse {
  userId: string;
  role: "owner" | "admin" | "member" | string;
  displayRole?: string;
  status?: "active" | "removed" | "left";
  joinedAt: string;
  removedAt?: string;
  removedBy?: string;
  rejoinedAt?: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
}

export interface ChannelMemberResponse {
  userId: string;
  role: "admin" | "member";
}

export interface MeetingJoinResponse {
  token: string;
  meetingCode: string;
  status: string;
  isHost: boolean;
  displayName: string;

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
  targetIdentity?: string;

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

export interface MeetingDeviceStatus {
  isJoinedOnThisDevice: boolean;
  meetingCode: string;
}

export interface RoomMemberStatus {
  isMember: boolean;
  roomId?: string;
}

export interface ParticipantMetadata {
  deviceId: string; // xác định thiết bị nào đang trong cuộc họp
  avatarUrl: string;
  hasAdminPowers: boolean;
  role: "owner" | "admin" | "member" | "guest";
  status: "joined" | "waiting";
}

export interface ChannelFileResponse {
  _id: string;
  roomId: string;
  channelId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

export interface NotificationResponse {
  _id: string;
  userId: string;
  type: string;
  metadata: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}
