"use server";
import { createClient } from "@/lib/supabase/server";
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
  return redirect("/vi");
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
