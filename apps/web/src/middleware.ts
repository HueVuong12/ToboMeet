import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, httpOnly: true }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(vi|en)/);
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const currentLocale = localeMatch ? localeMatch[1] : cookieLocale || "vi";

  // Nếu người dùng đã đăng nhập, kiểm tra trạng thái tài khoản trong MongoDB
  if (user) {
    try {
      const nestjsUrl = process.env.NESTJS_BASE_URL || "http://127.0.0.1:3001/api";
      const statusRes = await fetch(
        `${nestjsUrl}/users/status-by-email?email=${encodeURIComponent(user.email!)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );
      if (statusRes.status === 403) {
        // Tài khoản bị khóa! Buộc đăng xuất trên Supabase và redirect về login
        await supabase.auth.signOut();
        const redirectResponse = NextResponse.redirect(
          new URL(`/${currentLocale}/login?error=error.auth.user_locked`, request.url)
        );
        // Copy cookies từ response sang redirectResponse để dọn sạch session cookies
        response.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, {
            path: "/",
            httpOnly: true,
          });
        });
        return redirectResponse;
      }
    } catch (e) {
      console.error("Middleware kiểm tra trạng thái người dùng lỗi:", e);
      await supabase.auth.signOut();
      const redirectResponse = NextResponse.redirect(
        new URL(`/${currentLocale}/login?error=error.auth.user_locked`, request.url)
      );
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          path: "/",
          httpOnly: true,
        });
      });
      return redirectResponse;
    }
  }
  const pathWithoutLocale = pathname.replace(/^\/(vi|en)/, "") || "/";
  const isAuthPage = AUTH_PATHS.includes(pathWithoutLocale);
  const isHomePage = pathWithoutLocale === "/";
  const isResetting = request.nextUrl.searchParams.get("step") === "reset"; // Đang ở bước reset password

  const isCallbackPage = pathWithoutLocale.startsWith("/auth/callback");
  const isPublicPage = isAuthPage || isHomePage || isCallbackPage;

  // Nếu người dùng đã có token (user tồn tại) và đang vào các trang cấm
  if (user && (isAuthPage || isHomePage) && !isResetting) {
    return NextResponse.redirect(
      new URL(`/${currentLocale}/dashboard`, request.url),
    );
  }

  // Nếu người dùng chưa có token (user không tồn tại) và đang vào các trang cần auth
  if (!user && !isPublicPage) {
    const redirectUrl = new URL(`/${currentLocale}`, request.url);
    const code = request.nextUrl.searchParams.get("code");
    if (pathWithoutLocale.startsWith("/room/join") && code) {
      redirectUrl.searchParams.set("pending_join_code", code);
    }
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
