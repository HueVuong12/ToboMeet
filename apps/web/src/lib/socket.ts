// src/lib/socket.ts
import { io } from "socket.io-client";

const RAW_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SOCKET_URL = RAW_URL.replace(/\/api\/?$/, "");

export interface AppSocket {
  connected: boolean;
  id?: string;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
}

/**
 * Socket instance cho nền tảng Web thông thường
 */
export const webSocket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

/**
 * Kiểm tra xem môi trường hiện tại có phải là ứng dụng Desktop (Electron)
 */
export function isDesktopApp(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as any).electronAPI?.socket)
  );
}

/**
 * Lớp điều hợp kết nối Socket từ Electron Main Process thông qua IPC
 */
class DesktopSocketBridge implements AppSocket {
  private listeners = new Map<string, Set<Function>>();
  private isConnected = false;
  private socketId?: string;
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized || typeof window === "undefined") return;
    const electronSocket = (window as any).electronAPI?.socket;
    if (!electronSocket) return;

    this.initialized = true;

    // Lấy trạng thái socket hiện tại từ Main Process
    electronSocket
      .getStatus()
      .then((status: { connected: boolean; id: string | null }) => {
        if (status) {
          this.isConnected = Boolean(status.connected);
          this.socketId = status.id || undefined;
          if (this.isConnected) {
            this.trigger("connect");
          }
        }
      })
      .catch(() => {});

    electronSocket.onConnect(() => {
      this.isConnected = true;
      this.trigger("connect");
    });

    electronSocket.onDisconnect((reason: any) => {
      this.isConnected = false;
      this.trigger("disconnect", reason);
    });

    electronSocket.onError((err: any) => {
      this.trigger("connect_error", err);
    });

    electronSocket.onEvent((eventName: string, ...args: any[]) => {
      this.trigger(eventName, ...args);
    });
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get id(): string | undefined {
    return this.socketId;
  }

  connect(): void {
    if (typeof window !== "undefined" && (window as any).electronAPI?.socket) {
      (window as any).electronAPI.socket.connect({ url: SOCKET_URL });
    }
  }

  disconnect(): void {
    if (typeof window !== "undefined" && (window as any).electronAPI?.socket) {
      (window as any).electronAPI.socket.disconnect();
    }
  }

  emit(event: string, ...args: any[]): void {
    if (typeof window !== "undefined" && (window as any).electronAPI?.socket) {
      (window as any).electronAPI.socket.emit(event, ...args);
    }
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Nếu lắng nghe "connect" khi socket đã sẵn sàng thì kích hoạt ngay
    if (event === "connect" && this.isConnected) {
      try {
        callback();
      } catch (e) {
        console.error("Lỗi callback connect:", e);
      }
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.listeners.delete(event);
        }
      }
    }
  }

  private trigger(event: string, ...args: any[]): void {
    const set = this.listeners.get(event);
    if (set) {
      Array.from(set).forEach((cb) => {
        try {
          cb(...args);
        } catch (error) {
          console.error(
            `[DesktopSocket] Lỗi listener của sự kiện "${event}":`,
            error,
          );
        }
      });
    }
  }
}

let desktopSocketInstance: DesktopSocketBridge | null = null;

export function getDesktopSocketBridge(): DesktopSocketBridge {
  if (!desktopSocketInstance) {
    desktopSocketInstance = new DesktopSocketBridge();
  }
  return desktopSocketInstance;
}

/**
 * Trả về socket thích hợp dựa trên môi trường (Desktop Main Process vs Web)
 */
export function getSocket(): AppSocket {
  if (isDesktopApp()) {
    return getDesktopSocketBridge();
  }
  return webSocket;
}

/**
 * Đối tượng socket tương thích ngược để các file import trực tiếp vẫn chạy đúng theo môi trường
 */
export const socket: AppSocket = new Proxy({} as AppSocket, {
  get(_target, prop) {
    const activeSocket = getSocket();
    const val = (activeSocket as any)[prop];
    return typeof val === "function" ? val.bind(activeSocket) : val;
  },
  set(_target, prop, value) {
    const activeSocket = getSocket();
    (activeSocket as any)[prop] = value;
    return true;
  },
});
