// src/app/[locale]/(auth)/layout.tsx
import React from "react";
import LanguageSwitcher from "@/components/commons/LanguageSwitcher";
import AuthLeftPanel from "@/components/auth/AuthLeftPanel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-white font-sans">
      {/* CỘT BÊN TRÁI: DYNAMIC BANNER XANH */}
      <AuthLeftPanel />

      {/* CỘT BÊN PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
      <div className="relative flex w-full flex-col items-center justify-center bg-[#FAFAFA] px-4 py-12 sm:px-6 lg:w-[45%] xl:w-[40%] border-l border-gray-100">
        {/* Nút chuyển ngôn ngữ đặt ở góc trên cùng bên phải */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-50">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-110">{children}</div>
      </div>
    </div>
  );
}
