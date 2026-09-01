// src/lib/socket.ts
import { io } from "socket.io-client";

const RAW_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SOCKET_URL = RAW_URL.replace(/\/api\/?$/, "");

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});
