"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// Tldraw cần các Web API chỉ có trên Browser (Canvas, WebGL, window, navigator)
// nên sử dụng dynamic import với ssr: false để tối ưu và tránh lỗi SSR
const MeetingWhiteboard = dynamic(
  () => import("@/components/whiteboard/MeetingWhiteboard"),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0e0e11] text-white">
        <div className="p-6 rounded-2xl bg-[#161619] border border-[#232328] flex flex-col items-center gap-4 max-w-sm shadow-2xl">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md -z-10" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-white mb-1">
              Đang tải Tobo Whiteboard...
            </h3>
            <p className="text-xs text-slate-400">
              Khởi tạo không gian vẽ cộng tác thời gian thực
            </p>
          </div>
        </div>
      </div>
    ),
  }
);

export default function StandaloneWhiteboardPage() {
  const params = useParams();
  const meetingCode =
    (params?.meetingCode as string) || (params?.code as string) || "";

  if (!meetingCode) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0e0e11] text-white">
        <p className="text-sm text-slate-400">Mã phòng họp không hợp lệ</p>
      </div>
    );
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#111113] touch-none select-none">
      <MeetingWhiteboard meetingCode={meetingCode} isStandalone={true} />
    </main>
  );
}
