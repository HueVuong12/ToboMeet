"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Tldraw sử dụng các Web API (Canvas, WebGL, window, navigator)
// nên cần load qua dynamic import với ssr: false để tránh lỗi SSR trong Next.js App Router
const WhiteboardDemo = dynamic(
  () => import("@/components/whiteboard/WhiteboardDemo"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-[#111113] text-white gap-3">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md -z-10" />
        </div>
        <p className="text-sm font-semibold text-slate-300 tracking-wide">
          Đang tải Tobo Whiteboard Canvas...
        </p>
      </div>
    ),
  }
);

export default function WhiteboardDemoPage() {
  return <WhiteboardDemo />;
}
