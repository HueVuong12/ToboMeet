"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSync } from "@tldraw/sync";
import { Tldraw, TLAssetStore } from "tldraw";
import "tldraw/tldraw.css";
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

// Simple base64 asset store for demo/prototyping purposes
const demoAssetStore: TLAssetStore = {
  upload: async (_asset, file) => {
    return {
      src: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }),
    };
  },
  resolve: (asset) => asset.props.src,
};

interface WhiteboardCanvasProps {
  roomId: string;
  onSyncStatusChange?: (status: "loading" | "synced-remote" | "error", error?: string) => void;
}

function WhiteboardCanvas({ roomId, onSyncStatusChange }: WhiteboardCanvasProps) {
  // Kết nối tới WebSocket của apps/whiteboard
  const wsUri = `ws://localhost:3002/sync?roomId=${encodeURIComponent(roomId)}`;

  const store = useSync({
    uri: wsUri,
    assets: demoAssetStore,
  });

  useEffect(() => {
    if (store.status === "error") {
      onSyncStatusChange?.("error", store.error?.message || "Lỗi không xác định");
    } else {
      onSyncStatusChange?.(store.status);
    }
  }, [store.status, store.error, onSyncStatusChange]);

  if (store.status === "loading") {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#111113]/90 backdrop-blur-md text-white">
        <div className="p-6 rounded-2xl bg-[#161619] border border-[#232328] flex flex-col items-center gap-4 max-w-sm shadow-2xl">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md -z-10" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-white mb-1">Đang kết nối Whiteboard Server</h3>
            <p className="text-xs text-slate-400 font-mono break-all">{wsUri}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111113] border border-[#232328] text-[11px] text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Phòng: {roomId}</span>
          </div>
        </div>
      </div>
    );
  }

  if (store.status === "error") {
    return (
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#111113] text-white p-4">
        <div className="p-6 rounded-2xl bg-[#161619] border border-red-500/30 flex flex-col items-center gap-4 max-w-md text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1.5">Không thể kết nối Whiteboard Server</h3>
            <p className="text-xs text-slate-400 mb-3">
              Hãy đảm bảo server whiteboard đang chạy trên cổng <code className="text-blue-400 font-mono">3002</code>:
            </p>
            <div className="p-2.5 rounded-lg bg-[#111113] border border-[#232328] text-left text-xs font-mono text-slate-300">
              <span className="text-slate-500">$</span> npm run dev --workspace=apps/whiteboard
            </div>
            {store.error && (
              <p className="text-[11px] text-red-400/90 mt-2 font-mono bg-red-500/10 p-2 rounded border border-red-500/20 text-left">
                {store.error.message}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Thử kết nối lại</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Tldraw store={store.store} autoFocus />
    </div>
  );
}

export default function WhiteboardDemo() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialRoom = searchParams.get("roomId") || "demo-room";
  const [roomId, setRoomId] = useState(initialRoom);
  const [inputRoomId, setInputRoomId] = useState(initialRoom);
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced-remote" | "error">("loading");
  const [syncError, setSyncError] = useState<string>("");
  const [isHttpOk, setIsHttpOk] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // Ping HTTP server health check
  const checkHttpServer = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3002/", { cache: "no-store" });
      const data = await res.json();
      setIsHttpOk(data.status === "ok");
    } catch {
      setIsHttpOk(false);
    }
  }, []);

  useEffect(() => {
    checkHttpServer();
    const interval = setInterval(checkHttpServer, 10000);
    return () => clearInterval(interval);
  }, [checkHttpServer]);

  // Cập nhật roomId vào URL mà không reload trang
  const handleApplyRoomId = (newId: string) => {
    const trimmed = newId.trim() || "demo-room";
    setRoomId(trimmed);
    setInputRoomId(trimmed);
    const params = new URLSearchParams(searchParams.toString());
    params.set("roomId", trimmed);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Đã sao chép liên kết bảng vẽ!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSecondTab = () => {
    if (typeof window === "undefined") return;
    window.open(window.location.href, "_blank");
  };

  const handleCreateRandomRoom = () => {
    const randomId = `room-${Math.random().toString(36).substring(2, 8)}`;
    handleApplyRoomId(randomId);
    toast.info(`Đã chuyển sang phòng mới: ${randomId}`);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#111113] overflow-hidden select-none">
      {/* ================= HEADER BAR ================= */}
      <header className="h-14 px-4 bg-[#161619] border-b border-[#232328] flex items-center justify-between z-20 shrink-0 gap-3">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Layers size={18} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                <span>ToboMeet Whiteboard</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 font-mono uppercase">
                  tldraw sync
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 leading-tight">Multiplayer Live Demo</p>
            </div>
          </div>

          <div className="h-5 w-px bg-[#232328] hidden md:block" />

          {/* Trạng thái kết nối Server */}
          <div className="flex items-center gap-2 text-xs">
            {/* HTTP Server Pill */}
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                isHttpOk === true
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400"
                  : isHttpOk === false
                    ? "bg-red-950/30 border-red-500/30 text-red-400"
                    : "bg-[#111113] border-[#232328] text-slate-400"
              }`}
              title="HTTP Health check trên port 3002"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isHttpOk === true ? "bg-emerald-400 animate-pulse" : isHttpOk === false ? "bg-red-400" : "bg-slate-500"
                }`}
              />
              <span>Server :3002</span>
            </div>

            {/* WebSocket Sync Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                syncStatus === "synced-remote"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : syncStatus === "loading"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {syncStatus === "synced-remote" ? (
                <>
                  <Wifi size={13} className="text-emerald-400" />
                  <span>Realtime Sync: Online</span>
                </>
              ) : syncStatus === "loading" ? (
                <>
                  <Loader2 size={13} className="animate-spin text-amber-400" />
                  <span>Đang kết nối sync...</span>
                </>
              ) : (
                <>
                  <WifiOff size={13} className="text-red-400" />
                  <span>Mất kết nối sync</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Room ID Changer */}
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleApplyRoomId(inputRoomId);
            }}
            className="flex items-center gap-1.5 bg-[#111113] border border-[#232328] rounded-xl px-2 py-1 focus-within:border-blue-500 transition-colors"
          >
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Phòng:</span>
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              placeholder="Nhập Room ID..."
              className="w-24 sm:w-32 bg-transparent text-xs text-white outline-none font-mono"
            />
            {inputRoomId !== roomId && (
              <button
                type="submit"
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Vào
              </button>
            )}
          </form>

          <button
            onClick={handleCreateRandomRoom}
            title="Tạo phòng ngẫu nhiên mới"
            className="p-2 bg-[#111113] hover:bg-[#232328] border border-[#232328] text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <Sparkles size={14} className="text-amber-400" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111113] hover:bg-[#232328] border border-[#232328] text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Sao chép link phòng để chia sẻ hoặc mở tab ẩn danh"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copied ? "Đã chép" : "Sao chép link"}</span>
          </button>

          <button
            onClick={handleOpenSecondTab}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            title="Mở thêm 1 tab nữa với cùng roomId để kiểm tra vẽ đồng thời 2 bên"
          >
            <ExternalLink size={14} />
            <span className="hidden md:inline">Mở tab 2 (Test sync)</span>
          </button>
        </div>
      </header>

      {/* ================= TLDRaw CANVAS AREA ================= */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        <WhiteboardCanvas
          key={roomId}
          roomId={roomId}
          onSyncStatusChange={(status, err) => {
            setSyncStatus(status);
            if (err) setSyncError(err);
          }}
        />
      </main>
    </div>
  );
}
