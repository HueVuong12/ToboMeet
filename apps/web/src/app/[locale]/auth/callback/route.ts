import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  // Nếu có tham số 'next' trên URL (ví dụ: muốn chuyển về /vi sau khi login), nếu không thì mặc định về /vi
  const next = searchParams.get("next") ?? "/";

  const localeMatch = next.match(/^\/(vi|en)/);
  const locale = localeMatch ? localeMatch[1] : "vi";

  // Kiểm tra trước xem có lỗi tài khoản bị khóa từ Supabase gửi về không
  const errorParam = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDesc = searchParams.get("error_description");
  
  if (
    errorCode === "user_banned" || 
    errorParam === "access_denied" || 
    errorDesc?.toLowerCase().includes("banned") ||
    errorDesc?.toLowerCase().includes("locked")
  ) {
    return NextResponse.redirect(
      `${origin}/${locale}/login?error=error.auth.user_locked`,
    );
  }

  // Nếu Facebook/Google có trả về mã 'code'
  if (code) {
    const supabase = await createClient();

    // Đổi mã code lấy Session.
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // 1. Kiểm tra trạng thái tài khoản trên MongoDB sau khi đã biết Email từ Session
      try {
        const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
        const email = data.user.email;
        if (email) {
          const statusRes = await fetch(
            `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(email)}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
            }
          );
          if (statusRes.status === 403) {
            // Đăng xuất ngay lập tức
            await supabase.auth.signOut();
            return NextResponse.redirect(
              `${origin}/${locale}/login?error=error.auth.user_locked`,
            );
          }

          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const userResult = statusData?.result;
            if (userResult && userResult.exists === true && userResult.status === "locked") {
              // Đăng xuất ngay lập tức
              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${origin}/${locale}/login?error=error.auth.user_locked`,
              );
            }
          }
        }
      } catch (err) {
        console.error("Lỗi check status sau OAuth exchange:", err);
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/${locale}/login?error=error.auth.user_locked`,
        );
      }

      if (type === "recovery" || next.includes("forgot-password")) {
        return NextResponse.redirect(`${origin}/${locale}/forgot-password?step=reset`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    if (error) {
      console.error("Lỗi exchangeCodeForSession:", error.message);
      // Ghi log lỗi thô ra file để chẩn đoán chính xác
      try {
        const fs = require("fs");
        const path = require("path");
        const logPath = path.join(process.cwd(), "debug_oauth.log");
        fs.appendFileSync(
          logPath,
          `[${new Date().toISOString()}] OAuth Error: ${error.message} (status: ${error.status})\n`
        );
      } catch (e) {}

      const msg = error.message.toLowerCase();
      if (
        msg.includes("banned") ||
        msg.includes("locked") ||
        msg.includes("invalid_grant") ||
        msg.includes("suspended")
      ) {
        return NextResponse.redirect(
          `${origin}/${locale}/login?error=error.auth.user_locked`,
        );
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/${locale}/login?error=error.auth.oauth_failed`,
  );
}
