import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import {
    TLSocketRoom,
    NodeSqliteWrapper,
    SQLiteSyncStorage,
} from "@tldraw/sync-core";

const app = express();
const PORT = 3002;

// Enable CORS for health check and API calls
app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

// Thư mục lưu trữ database SQLite cho từng room
const DATA_DIR = path.resolve(process.cwd(), "data", "rooms");
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Tạo đường dẫn file SQLite an toàn từ roomId
 */
function getRoomDbPath(roomId: string): string {
    const safeName = roomId.replace(/[^a-zA-Z0-9_-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
    return path.join(DATA_DIR, `${safeName}.sqlite`);
}

interface ActiveRoom {
    room: TLSocketRoom;
    db: DatabaseSync;
}

// Bộ nhớ đệm các phòng đang có kết nối hoạt động
const rooms = new Map<string, ActiveRoom>();

/**
 * Lấy phòng hiện tại hoặc mở/khởi tạo cơ sở dữ liệu SQLite cho phòng
 */
function getOrCreateRoom(roomId: string): TLSocketRoom {
    const existing = rooms.get(roomId);
    if (existing) {
        return existing.room;
    }

    const dbPath = getRoomDbPath(roomId);
    const isExistingDb = fs.existsSync(dbPath);

    if (isExistingDb) {
        console.log(`📂 Restoring room state from SQLite: ${roomId} (${dbPath})`);
    } else {
        console.log(`🆕 Creating new room with SQLite storage: ${roomId} (${dbPath})`);
    }

    const db = new DatabaseSync(dbPath);

    // Tối ưu hóa hiệu năng và độ an toàn cho SQLite
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");

    const sql = new NodeSqliteWrapper(db);
    const storage = new SQLiteSyncStorage({ sql });

    const room = new TLSocketRoom({
        storage,
        onSessionRemoved: (_room, { sessionId, numSessionsRemaining }) => {
            console.log(
                `👋 Session ${sessionId} left ${roomId}. Remaining: ${numSessionsRemaining}`
            );

            // Khi không còn ai trong phòng, giải phóng RAM và đóng kết nối DB
            // Toàn bộ hình vẽ và trạng thái đã được lưu an toàn trong SQLite
            if (numSessionsRemaining === 0) {
                console.log(`💤 Room ${roomId} idle. Closing SQLite connection and unloading from memory.`);
                rooms.delete(roomId);
                room.close();
                try {
                    db.close();
                } catch (err) {
                    console.error(`Error closing database for room ${roomId}:`, err);
                }
            }
        },
    });

    rooms.set(roomId, { room, db });
    return room;
}

// Health check endpoint
app.get("/", (_req, res) => {
    res.json({
        message: "ToboMeet Whiteboard Sync Server",
        status: "ok",
        persistence: "sqlite",
        activeRooms: rooms.size,
        dataDirectory: DATA_DIR,
    });
});

// Endpoint xem danh sách các phòng đã lưu trên ổ đĩa
app.get("/rooms", (_req, res) => {
    try {
        const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".sqlite"));
        const roomList = files.map((file) => {
            const stat = fs.statSync(path.join(DATA_DIR, file));
            const base = file.replace(/\.sqlite$/, "");
            return {
                fileName: file,
                sizeBytes: stat.size,
                lastModified: stat.mtime,
                isActiveInMemory: Array.from(rooms.keys()).some((r) => getRoomDbPath(r).endsWith(file)),
            };
        });
        res.json({ rooms: roomList });
    } catch (err: any) {
        res.status(500).json({ error: err?.message });
    }
});

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({
    server,
    path: "/sync",
});

wss.on("connection", (socket, request) => {
    const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`
    );

    const roomId = url.searchParams.get("roomId");

    if (!roomId) {
        console.log("Missing roomId");
        socket.close();
        return;
    }

    console.log(`🔌 Client connecting to room: ${roomId}`);

    const room = getOrCreateRoom(roomId);
    const sessionId = randomUUID();

    console.log(`👤 Session ${sessionId} joined ${roomId}`);

    // Cho socket tham gia tldraw room
    room.handleSocketConnect({
        sessionId,
        socket,
    });
});

// Graceful shutdown: đóng tất cả kết nối DB và room sạch sẽ khi server dừng
function handleShutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}. Shutting down whiteboard server...`);
    for (const [roomId, { room, db }] of rooms.entries()) {
        console.log(`💾 Persisting and closing room: ${roomId}`);
        try {
            room.close();
            db.close();
        } catch (err) {
            console.error(`Error closing room ${roomId}:`, err);
        }
    }
    rooms.clear();
    server.close(() => {
        console.log("Server closed cleanly.");
        process.exit(0);
    });
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

server.listen(PORT, () => {
    console.log(`🚀 Whiteboard server running at http://localhost:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/sync`);
    console.log(`💾 SQLite persistence directory: ${DATA_DIR}`);
});
