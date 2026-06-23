// src/app/[locale]/(auth)/layout.tsx
import React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-white font-sans">
      <div className="relative hidden w-full items-center justify-center bg-[#0052FF] overflow-hidden lg:flex lg:w-[55%] xl:w-[60%]">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-10 -right-20 h-80 w-80 rounded-full bg-[#00D4FF]/20 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-linear-to-tr from-white/5 to-transparent backdrop-blur-sm"></div>

        <div className="relative z-10 flex w-full max-w-xl flex-col px-12 text-white">
          <Link
            href="/"
            className="mb-12 flex items-center gap-2 hover:opacity-90 transition-opacity w-fit"
          >
            <div className="rounded-xl bg-white p-2 text-[#0052FF]">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="text-3xl font-bold tracking-tight">ToboMeet</span>
          </Link>

          <h1 className="mb-6 text-4xl font-extrabold leading-tight xl:text-5xl">
            Kết nối không giới hạn.
            <br />
            <span className="text-white/70">Hợp tác thông minh hơn.</span>
          </h1>

          <p className="mb-10 text-lg text-white/80 leading-relaxed">
            Nền tảng video call tối ưu cho đội nhóm và doanh nghiệp. Mang lại
            trải nghiệm mượt mà, bảo mật và hoàn toàn chủ động.
          </p>

          {/* Khung Testimonial hoặc thông số */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex -space-x-3">
                <div className="h-10 w-10 rounded-full border-2 border-[#0052FF] bg-pink-400"></div>
                <div className="h-10 w-10 rounded-full border-2 border-[#0052FF] bg-emerald-400"></div>
                <div className="h-10 w-10 rounded-full border-2 border-[#0052FF] bg-amber-400"></div>
              </div>
              <p className="text-sm font-medium text-white/90">
                Hơn <span className="font-bold text-white">50.000+</span> đội
                nhóm tin dùng
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-[#FAFAFA] px-4 py-12 sm:px-6 lg:w-[45%] xl:w-[40%] border-l border-gray-100">
        <div className="w-full max-w-110">{children}</div>
      </div>
    </div>
  );
}
