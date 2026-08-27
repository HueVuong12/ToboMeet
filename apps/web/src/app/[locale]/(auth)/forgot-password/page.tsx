// ─── Forgot Password Page ─────────────────────────────────────────────────────
// Route: /[locale]/forgot-password
// Server component — SEO metadata + render ForgotPasswordForm client component.

import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

// ─── SEO Metadata ─────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    vi: "Quên mật khẩu — ToboMeet",
    en: "Forgot Password — ToboMeet",
  };
  const descriptions: Record<string, string> = {
    vi: "Đặt lại mật khẩu tài khoản ToboMeet của bạn. Nhập email để nhận link đặt lại.",
    en: "Reset your ToboMeet account password. Enter your email to receive a reset link.",
  };

  return {
    title: titles[locale] ?? titles["vi"],
    description: descriptions[locale] ?? descriptions["vi"],
    robots: { index: false, follow: false },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
