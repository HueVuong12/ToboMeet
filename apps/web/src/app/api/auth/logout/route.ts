import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/auth/logout
// Đăng xuất session Supabase hiện tại rồi chuyển hướng về trang login.
// Dùng cho nút "Đăng nhập" trên landing page để đảm bảo user luôn phải nhập lại thông tin.
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Xác định locale từ query param hoặc cookie
  const searchParams = request.nextUrl.searchParams;
  const locale = searchParams.get("locale") ||
    request.cookies.get("NEXT_LOCALE")?.value ||
    "vi";

  // Đăng xuất khỏi Supabase (xoá session cookie)
  await supabase.auth.signOut();

  // Redirect về trang login với locale đúng
  const loginUrl = new URL(`/${locale}/login`, request.url);
  return NextResponse.redirect(loginUrl);
}
