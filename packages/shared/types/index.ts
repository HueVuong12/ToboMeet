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
  // Thêm các lỗi khác của hệ thống vào đây...
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
