"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { FormState, signup } from "../../auth/actions";
import { Video } from "lucide-react";

const initialState: FormState = { error: null, message: null };

export default function SignupPage() {
  const [state, action, isPending] = useActionState(signup, initialState);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setLocalError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const password = formData.get("password") as string | null;
    const confirm = formData.get("confirmPassword") as string | null;

    if (password == null || confirm == null) {
      setLocalError("Vui lòng nhập mật khẩu và xác nhận mật khẩu.");
      e.preventDefault();
      return;
    }

    if (password.length < 6) {
      setLocalError("Mật khẩu phải có tối thiểu 6 ký tự.");
      e.preventDefault();
      return;
    }

    if (password !== confirm) {
      setLocalError("Mật khẩu và xác nhận mật khẩu không khớp.");
      e.preventDefault();
      return;
    }
  };

  return (
    <div className="p-8 sm:p-10 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl border border-gray-100">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 group flex-shrink-0"
        >
          <div className="relative flex h-9 w-9 items-center justify-center">
            {/* Nền gradient chéo */}
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300 shadow-md"></div>
            {/* Nền đổ bóng mờ ảo */}
            <div className="absolute inset-0 bg-brand-500 blur opacity-40 rounded-xl group-hover:opacity-60 transition-opacity duration-300"></div>
            {/* Icon */}
            <div className="relative z-10 text-white">
              <Video
                size={18}
                strokeWidth={2.5}
                className="group-hover:scale-110 transition-transform duration-300"
              />
            </div>
          </div>
          <span className="text-[22px] font-black tracking-tighter text-navy">
            Tobo
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-500">
              Meet
            </span>
          </span>
        </Link>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">
          Tạo tài khoản mới
        </h1>
        <p className="text-gray-500 text-sm">
          Kết nối không giới hạn, họp thông minh hơn
        </p>
      </div>

      {/* Khung báo lỗi server-side */}
      {state.error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-sm font-medium">
          {state.error}
        </div>
      )}

      {/* Khung báo lỗi client-side */}
      {localError && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-sm font-medium">
          {localError}
        </div>
      )}

      {/* Khung báo thành công (Yêu cầu check email) */}
      {state.message && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl text-sm font-medium flex items-start gap-3">
          <svg
            className="w-5 h-5 text-green-500 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{state.message}</span>
        </div>
      )}

      <form
        action={action}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Email công việc
          </label>
          <input
            name="email"
            type="email"
            required
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10 focus:border-[#0052FF] focus:bg-white transition-all text-gray-900"
            placeholder="nhap@email.com"
          />
        </div>

        <div>
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Mật khẩu
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10 focus:border-[#0052FF] focus:bg-white transition-all text-gray-900"
            placeholder="Tối thiểu 6 ký tự"
          />
        </div>

        <div>
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            Nhập lại mật khẩu
          </label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10 focus:border-[#0052FF] focus:bg-white transition-all text-gray-900"
            placeholder="Nhập lại mật khẩu"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 bg-[#0052FF] text-white px-4 py-3.5 rounded-full font-medium text-[15px] hover:bg-[#0040D1] transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {isPending ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
            "Đăng ký tài khoản"
          )}
        </button>
      </form>

      <p className="text-center mt-8 text-sm text-gray-500 font-medium">
        Đã có tài khoản?{" "}
        <Link href="/vi/login" className="text-[#0052FF] hover:underline">
          Đăng nhập ngay
        </Link>
      </p>
    </div>
  );
}
