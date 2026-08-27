"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Video, Lock, ShieldCheck, Users } from "lucide-react";

export default function AuthLeftPanel() {
  const pathname = usePathname();
  const tAuth = useTranslations("auth_layout");
  const tForgot = useTranslations("forgot_password");

  const isForgotPassword = pathname.includes("/forgot-password");

  if (isForgotPassword) {
    return (
      <div className="relative hidden w-full items-center justify-center bg-[#0052FF] overflow-hidden lg:flex lg:w-[55%] xl:w-[60%]">
        {/* Decorative blurs */}
        <div className="absolute top-1/4 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-24 w-72 h-72 bg-[#00D4FF]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col min-h-screen px-12 py-10 w-full max-w-xl mx-auto">
          {/* MIDDLE: Branding content — centered vertically */}
          <div className="flex-1 flex flex-col justify-center w-full">
            {/* --- KHU VỰC LOGO --- */}
            <Link
              href="/"
              className="mb-12 flex items-center gap-2.5 group shrink-0 w-fit"
            >
              <div className="relative flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 bg-white rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300 shadow-md"></div>
                <div className="absolute inset-0 bg-white blur opacity-40 rounded-xl group-hover:opacity-60 transition-opacity duration-300"></div>
                <div className="relative z-10 text-[#0052FF]">
                  <Video
                    size={20}
                    strokeWidth={2.5}
                    className="group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>

              <span className="text-[28px] font-black tracking-tighter text-white">
                Tobo
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-white">
                  Meet
                </span>
              </span>
            </Link>

            <div className="animate-fade-in-up flex items-center gap-5 mb-6">
              <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 shadow-sm backdrop-blur-md">
                <Lock size={32} className="text-white" strokeWidth={1.8} />
              </div>
              <h1 className="text-4xl xl:text-[3.25rem] font-black tracking-tighter leading-tight whitespace-nowrap">
                <span className="text-white">{tForgot("branding_tagline")}</span>{" "}
                <span className="text-white">{tForgot("branding_tagline_accent")}</span>
              </h1>
            </div>
            <p className="animate-fade-in-up delay-200 text-white/80 text-[18px] leading-relaxed max-w-md mb-10">
              {tForgot("branding_desc")}
            </p>

            {/* Badges */}
            <div className="animate-fade-in-up delay-300 flex flex-col gap-3">
              {[
                { icon: ShieldCheck, label: tForgot("badge_e2e"), color: "text-emerald-400" },
                { icon: Lock, label: tForgot("badge_secure"), color: "text-[#00D4FF]" },
                { icon: Users, label: tForgot("badge_users"), color: "text-violet-300" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/10 bg-white/10 backdrop-blur-md w-fit">
                  <Icon size={18} className={`${color} flex-shrink-0`} />
                  <span className="text-white text-[15px] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM: Copyright */}
          <p className="text-white/60 text-[13px] pb-2 text-center">
            © 2026 ToboMeet · Graduation Thesis Project
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative hidden w-full items-center justify-center bg-[#0052FF] overflow-hidden lg:flex lg:w-[55%] xl:w-[60%]">
      {/* Các mảng màu trang trí */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
      <div className="absolute bottom-10 -right-20 h-80 w-80 rounded-full bg-[#00D4FF]/20 blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-gradient-to-tr from-white/5 to-transparent backdrop-blur-sm"></div>

      <div className="relative z-10 flex w-full max-w-xl flex-col px-12 text-white">
        {/* --- KHU VỰC LOGO --- */}
        <Link
          href="/"
          className="mb-12 flex items-center gap-2.5 group shrink-0 w-fit"
        >
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute inset-0 bg-white rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300 shadow-md"></div>
            <div className="absolute inset-0 bg-white blur opacity-40 rounded-xl group-hover:opacity-60 transition-opacity duration-300"></div>
            <div className="relative z-10 text-[#0052FF]">
              <Video
                size={20}
                strokeWidth={2.5}
                className="group-hover:scale-110 transition-transform duration-300"
              />
            </div>
          </div>

          <span className="text-[28px] font-black tracking-tighter text-white">
            Tobo
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-white">
              Meet
            </span>
          </span>
        </Link>
        {/* --- KẾT THÚC KHU VỰC LOGO --- */}

        <h1 className="mb-6 text-4xl font-extrabold leading-tight xl:text-5xl">
          {tAuth("connect_without_limits")}
          <br />
          <span className="text-white/70">
            {tAuth("smart_collaboration")}
          </span>
        </h1>

        <p className="mb-10 text-lg text-white/80 leading-relaxed">
          {tAuth("platform_description")}
        </p>

        {/* Khung Testimonial hoặc thông số */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex -space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#0095FF] text-[13px] font-bold text-white shadow-sm">NH</div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#8B5CF6] text-[13px] font-bold text-white shadow-sm">HL</div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#10B981] text-[13px] font-bold text-white shadow-sm">PH</div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#FF5A4F] text-[13px] font-bold text-white shadow-sm">TH</div>
            </div>
            <p className="text-sm font-medium text-white/90">
              {tAuth("joined_by")}{" "}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
