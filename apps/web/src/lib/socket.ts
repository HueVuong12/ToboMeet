// src/lib/socket.ts
import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});
