"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { FormState, signup } from "../../auth/actions";
import { Video } from "lucide-react";
import { useTranslations } from "next-intl";

const initialState: FormState = { error: null, message: null };

export default function SignupPage() {
  const t = useTranslations();
  const [state, action, isPending] = useActionState(signup, initialState);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setLocalError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const password = formData.get("password") as string | null;
    const confirm = formData.get("confirmPassword") as string | null;

    if (password == null || confirm == null) {
      setLocalError("error.auth.missing_fields");
      e.preventDefault();
      return;
    }

    if (password.length < 6) {
      setLocalError("error.auth.password_too_short");
      e.preventDefault();
      return;
    }

    if (password !== confirm) {
      setLocalError("error.auth.password_mismatch");
      e.preventDefault();
      return;
    }
  };

  return (
    <div className="p-8 sm:p-10 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl border border-gray-100">
      {/* Logo */}
      <div className="flex justify-center mb-4">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative flex h-9 w-9 items-center justify-center">
            {/* Nền gradient chéo */}
            <div className="absolute inset-0 bg-linear-to-tr from-brand-600 to-indigo-500 rounded-xl transform rotate-3 group-hover:rotate-6 transition-transform duration-300 shadow-md"></div>
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
            <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-600 to-indigo-500">
              Meet
            </span>
          </span>
        </Link>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">
          {t("signup.sign_up")}
        </h1>
        <p className="text-gray-500 text-sm">
          {t("signup.create_account_to_continue")}
        </p>
      </div>

      {/* Khung báo lỗi server-side */}
      {state.error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-sm font-medium">
          {t(state.error)}
        </div>
      )}

      {/* Khung báo lỗi client-side */}
      {localError && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-sm font-medium">
          {t(localError)}
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
          <span>{t(state.message)}</span>
        </div>
      )}

      <form
        action={action}
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            {t("signup.work_email")}
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
            {t("signup.password")}
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10 focus:border-[#0052FF] focus:bg-white transition-all text-gray-900"
            placeholder={t("signup.password_placeholder")}
          />
        </div>

        <div>
          <label className="block mb-1.5 text-sm font-semibold text-gray-700">
            {t("signup.confirm_password")}
          </label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10 focus:border-[#0052FF] focus:bg-white transition-all text-gray-900"
            placeholder={t("signup.confirm_password_placeholder")}
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
            t("login.sign_up")
          )}
        </button>
      </form>

      <p className="text-center mt-8 text-sm text-gray-500 font-medium">
        {t("signup.already_have_account")}{" "}
        <Link href="/login" className="text-[#0052FF] hover:underline">
          {t("login.sign_in")}
        </Link>
      </p>
    </div>
  );
}
