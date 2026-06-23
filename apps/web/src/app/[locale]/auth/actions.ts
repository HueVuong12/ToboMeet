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

    let errorMessage = "Đã có lỗi xảy ra trong quá trình đăng nhập.";

    // Bóc tách từng trường hợp lỗi thường gặp của Supabase
    if (error.message.includes("Invalid login credentials")) {
      errorMessage = "Email hoặc mật khẩu không chính xác.";
    } else if (error.message.includes("Email not confirmed")) {
      errorMessage =
        "Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn để xác nhận.";
    } else if (
      error.message.includes("Too many requests") ||
      error.status === 429
    ) {
      errorMessage =
        "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi một lát rồi thử lại.";
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
      error: "Đã có lỗi xảy ra khi đăng ký, vui lòng thử lại.",
      message: null,
    };
  }

  return {
    error: null,
    message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.",
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
      error: `Không thể kết nối tới ${provider}. Vui lòng thử lại sau.`,
      message: null,
    };
  }

  if (data.url) {
    // Nếu thành công, BẮT BUỘC phải redirect sang trang của FB/Google
    return redirect(data.url);
  }

  return { error: "Lỗi không xác định.", message: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();

  return redirect(`/${locale}/login`);
}
