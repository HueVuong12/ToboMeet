import ws = require("ws");

// Polyfill WebSocket toàn cục cho Node.js v20 (để Supabase sử dụng)
globalThis.WebSocket = ws as any;
