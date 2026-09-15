import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { TLSocketRoom } from "@tldraw/sync-core";

const app = express();

const PORT = 3002;

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({
    server,
    path: "/sync",
});

// Mỗi roomId sẽ có một TLSocketRoom
const rooms = new Map<string, TLSocketRoom>();

// Health check
app.get("/", (_req, res) => {
    res.json({
        message: "ToboMeet Whiteboard Sync Server",
        status: "ok",
    });
});

wss.on("connection", (socket, request) => {
    const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`
    );

    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
        console.log("❌ Missing roomId");
        socket.close();
        return;
    }

    console.log(`🔌 Client connecting to room: ${roomId}`);

    // Lấy room hiện tại
    let room = rooms.get(roomId);

    // Nếu room chưa tồn tại thì tạo mới
    if (!room) {
        console.log(`🆕 Creating room: ${roomId}`);

        room = new TLSocketRoom({
            onSessionRemoved: (_room, { sessionId, numSessionsRemaining }) => {
                console.log(
                    `👋 Session ${sessionId} left ${roomId}. Remaining: ${numSessionsRemaining}`
                );

                // Nếu không còn ai trong room thì xóa room khỏi memory
                if (numSessionsRemaining === 0) {
                    rooms.delete(roomId);
                    room?.close();

                    console.log(`🗑️ Room removed: ${roomId}`);
                }
            },
        });

        rooms.set(roomId, room);
    }

    const sessionId = randomUUID();

    console.log(`👤 Session ${sessionId} joined ${roomId}`);

    // Cho socket tham gia tldraw room
    room.handleSocketConnect({
        sessionId,
        socket,
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Whiteboard server running at http://localhost:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/sync`);
});