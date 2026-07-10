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
  const pathWithoutLocale = pathname.replace(/^\/(vi|en)/, "") || "/";
  const isAuthPage = AUTH_PATHS.includes(pathWithoutLocale);
  const isHomePage = pathWithoutLocale === "/";
  const isResetting = request.nextUrl.searchParams.get("step") === "reset"; // Đang ở bước reset password

  const localeMatch = pathname.match(/^\/(vi|en)/);
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const currentLocale = localeMatch ? localeMatch[1] : cookieLocale || "vi";

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
    return NextResponse.redirect(new URL(`/${currentLocale}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
