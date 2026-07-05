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

  // 1. Kiểm tra trạng thái tài khoản từ MongoDB qua NestJS
  try {
    const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
    const statusRes = await fetch(
      `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );

    if (statusRes.status === 403) {
      return { error: "error.auth.user_locked", message: null };
    }

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      const userResult = statusData?.result;
      if (userResult && typeof userResult === "object") {
        if (userResult.exists === false) {
          return { error: "error.auth.user_not_found", message: null };
        }
        if (userResult.exists === true && userResult.status === "locked") {
          return { error: "error.auth.user_locked", message: null };
        }
      }
    } else {
      console.warn("Không thể check status từ NestJS, mã lỗi:", statusRes.status);
    }
  } catch (err) {
    console.error("Lỗi khi kết nối NestJS check status:", err);
    return { error: "error.auth.login_failed", message: null };
  }

  // 2. Xác thực bằng Supabase Auth
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Chi tiết lỗi Supabase:", error.message);

    let errorMessage = "error.auth.login_failed";

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

  return redirect(`/${locale}/dashboard`);
}

export async function signup(prevState: FormState, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  
  // 1. Kiểm tra xem email có bị khóa (BLOCKED) trong MongoDB không
  try {
    const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
    const statusRes = await fetch(
      `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (statusRes.status === 403) {
      return { error: "error.auth.user_locked", message: null };
    }
  } catch (err) {
    console.error("Lỗi check status khi đăng ký:", err);
    return { error: "error.auth.user_locked", message: null };
  }

  const supabase = await createClient();

  const { data: isEmailTaken, error: rpcError } = await supabase.rpc(
    "check_email_exists",
    { lookup_email: email },
  );

  if (rpcError) {
    console.error("Lỗi khi check email:", rpcError);
    return {
      error: "error.auth.signup_failed",
      message: null,
    };
  }

  if (isEmailTaken) {
    return {
      error: "error.auth.user_existed",
      message: null,
    };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    let errorMessage = "error.auth.signup_failed";
    console.error("Lỗi khi đăng kí:", error.message);

    if (
      error.message.includes(
        "Password should contain at least one character of each",
      )
    ) {
      errorMessage = "error.auth.password_invalid";
    }

    return {
      error: errorMessage,
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
      redirectTo: `${siteUrl}/auth/callback?next=/${locale}/dashboard`,
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

// 1. Gửi mã OTP về email
export async function sendPasswordResetOtp(email: string) {
  // Kiểm tra xem email có bị khóa (BLOCKED) trong MongoDB không
  try {
    const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
    const statusRes = await fetch(
      `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (statusRes.status === 403) {
      return { success: false, error: "error.auth.user_locked" };
    }
  } catch (err) {
    console.error("Lỗi check status khi gửi OTP reset mật khẩu:", err);
    return { success: false, error: "error.auth.user_locked" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    console.error("Lỗi gửi OTP:", error.message);
    return {
      success: false,
      error: "otp_send_failed",
    };
  }

  return { success: true };
}

// 2. Xác thực mã OTP (Tạo phiên đăng nhập tạm thời)
export async function verifyPasswordResetOtp(email: string, token: string) {
  // Kiểm tra xem email có bị khóa (BLOCKED) trong MongoDB không
  try {
    const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
    const statusRes = await fetch(
      `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (statusRes.status === 403) {
      return { success: false, error: "error.auth.user_locked" };
    }
  } catch (err) {
    console.error("Lỗi check status khi verify OTP:", err);
    return { success: false, error: "error.auth.user_locked" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery", // Bắt buộc phải là 'recovery' cho luồng quên mật khẩu
  });

  if (error) {
    console.error("Lỗi xác minh OTP:", error.message);
    return {
      success: false,
      error: "otp_invalid_or_expired",
    };
  }

  return { success: true };
}

// 3. Cập nhật mật khẩu mới (Khi đã có phiên đăng nhập từ bước 2)
export async function updatePassword(password: string) {
  const supabase = await createClient();

  // Kiểm tra xem email có bị khóa (BLOCKED) trong MongoDB không trước khi đổi mật khẩu
  const { data: { user } } = await supabase.auth.getUser();
  if (user && user.email) {
    try {
      const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
      const statusRes = await fetch(
        `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(user.email)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (statusRes.status === 403) {
        return { success: false, error: "error.auth.user_locked" };
      }
    } catch (err) {
      console.error("Lỗi check status khi update mật khẩu:", err);
      return { success: false, error: "error.auth.user_locked" };
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    let errorMessage = "password_update_failed";
    console.error("Lỗi cập nhật mật khẩu:", error.message);
    if (
      error.message.includes(
        "New password should be different from the old password",
      )
    ) {
      errorMessage = "new_password_must_be_different";
    }
    return { success: false, error: errorMessage };
  }

  await supabase.auth.signOut();

  return { success: true };
}
