// Shared TypeScript interfaces — dùng chung cho Web, Mobile, Desktop, Server

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
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
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

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
