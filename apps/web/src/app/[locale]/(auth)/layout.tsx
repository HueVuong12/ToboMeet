// src/app/[locale]/(auth)/layout.tsx
import React from "react";
import Link from "next/link";
import { Video } from "lucide-react"; // Nhớ import icon từ lucide-react nhé

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-white font-sans">
      {/* CỘT BÊN TRÁI: BANNER XANH */}
      <div className="relative hidden w-full items-center justify-center bg-[#0052FF] overflow-hidden lg:flex lg:w-[55%] xl:w-[60%]">
        {/* Các mảng màu trang trí */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-10 -right-20 h-80 w-80 rounded-full bg-[#00D4FF]/20 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-linear-to-tr from-white/5 to-transparent backdrop-blur-sm"></div>

        <div className="relative z-10 flex w-full max-w-xl flex-col px-12 text-white">
          {/* --- KHU VỰC LOGO ĐÃ ĐƯỢC CHỈNH LẠI MÀU SẮC --- */}
          <Link
            href="/"
            className="mb-12 flex items-center gap-2.5 group flex-shrink-0 w-fit"
          >
            <div className="relative flex h-10 w-10 items-center justify-center">
              {/* Nền hộp lệch: Đổi thành màu trắng để nổi bật trên nền xanh */}
              <div className="absolute inset-0 bg-white rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300 shadow-md"></div>
              {/* Nền đổ bóng: Dùng màu trắng mờ ảo */}
              <div className="absolute inset-0 bg-white blur opacity-40 rounded-xl group-hover:opacity-60 transition-opacity duration-300"></div>
              {/* Icon: Đổi sang màu xanh dương để ăn khớp với brand */}
              <div className="relative z-10 text-[#0052FF]">
                <Video
                  size={20}
                  strokeWidth={2.5}
                  className="group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </div>

            {/* Chữ Logo: Tobo màu trắng, Meet màu Gradient Cyan sáng */}
            <span className="text-[28px] font-black tracking-tighter text-white">
              Tobo
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-white">
                Meet
              </span>
            </span>
          </Link>
          {/* --- KẾT THÚC KHU VỰC LOGO --- */}

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

      {/* CỘT BÊN PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
      <div className="flex w-full flex-col items-center justify-center bg-[#FAFAFA] px-4 py-12 sm:px-6 lg:w-[45%] xl:w-[40%] border-l border-gray-100">
        <div className="w-full max-w-110">{children}</div>
      </div>
    </div>
  );
}
