"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormState, signup } from "../../auth/actions";

const initialState: FormState = { error: null, message: null };

export default function SignupPage() {
  const [state, action, isPending] = useActionState(signup, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 font-sans">
      <div className="w-full max-w-110 p-8 sm:p-10 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl border border-gray-100">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link
            href="/vi"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="bg-[#0052FF] text-white p-2 rounded-xl">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold text-[#0F172A] tracking-tight">
              ToboMeet
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

        {/* Khung báo lỗi */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-sm font-medium">
            {state.error}
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

        <form action={action} className="flex flex-col gap-5">
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
    </div>
  );
}
