import { io } from "socket.io-client";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://dolphin-paternity-estrogen.ngrok-free.dev/api";
const SOCKET_URL = API_BASE_URL.replace("/api", "");

console.log("[socket] Connecting to Socket.io at:", SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
