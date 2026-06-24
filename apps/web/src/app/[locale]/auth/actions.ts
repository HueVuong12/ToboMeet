"use server";
import { createClient } from "@/lib/supabase/server";
import { Provider } from "@supabase/supabase-js";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";

export type FormState = {
  error: string | null;
  message: string | null;
};

export async function login(prevState: FormState, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Chi tiết lỗi Supabase:", error.message);

    let errorMessage = "error.auth.login_failed";

    // Bóc tách từng trường hợp lỗi thường gặp của Supabase
    if (error.message.includes("Invalid login credentials")) {
      errorMessage = "error.auth.invalid_credentials";
    } else if (error.message.includes("Email not confirmed")) {
      errorMessage = "error.auth.email_not_confirmed";
    } else if (
      error.message.includes("Too many requests") ||
      error.status === 429
    ) {
      errorMessage = "error.auth.too_many_requests";
    }

    return { error: errorMessage, message: null };
  }

  const locale = await getLocale();

  return redirect(`/${locale}/home`);
}

export async function signup(prevState: FormState, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Chi tiết lỗi Supabase:", error.message);
    return {
      error: "error.auth.signup_failed",
      message: null,
    };
  }

  return {
    error: null,
    message: "signup.signup_success",
  };
}

export async function loginWithOAuth(
  provider: Provider,
  prevState: FormState, // Yêu cầu bắt buộc khi dùng với useActionState
  formData: FormData,
) {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const locale = await getLocale();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/${locale}/home`,
    },
  });

  if (error) {
    console.error(`Lỗi đăng nhập ${provider}:`, error);
    // Trả về object lỗi trực tiếp thay vì redirect
    return {
      error: `error.auth.oauth_failed`,
      message: null,
    };
  }

  if (data.url) {
    // Nếu thành công, BẮT BUỘC phải redirect sang trang của FB/Google
    return redirect(data.url);
  }

  return { error: "error.auth.unknown_error", message: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();

  return redirect(`/${locale}/login`);
}
