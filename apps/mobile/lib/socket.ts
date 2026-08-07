import { io } from "socket.io-client";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.65:3001/api";
const SOCKET_URL = API_BASE_URL.replace("/api", "");

console.log("[socket] Connecting to Socket.io at:", SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});
